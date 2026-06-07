import { readdirSync, readFileSync, existsSync } from 'fs';
import { basename, dirname, join } from 'path';
import { OkcaService } from './okca.service';
import { ColorUtilService } from './color-util.service';
import { ColorMetricsService } from './color-metrics.service';
import { PluginRegistry } from '@pawn002/klar-plugin-registry';
import type { ContrastPlugin } from '@pawn002/klar-plugin-interface';

const PLUGIN_PREFIX = 'klar-plugin-';

// These share the `klar-plugin-` prefix but are framework packages, not
// algorithm plugins — never load them as contrast plugins.
const FRAMEWORK_PACKAGES = new Set([
  '@pawn002/klar-plugin-interface',
  '@pawn002/klar-plugin-registry',
]);

/** Where a loaded plugin package came from, surfaced by `klar plugins list`. */
export interface PluginLoadRecord {
  /** npm package name, e.g. `klar-plugin-cvd-brettel`. */
  packageName: string;
  /** Package version from its package.json, or null if unreadable. */
  version: string | null;
  /** Absolute path the package resolved to. */
  resolvedPath: string;
  /**
   * - `project` — declared in the host project's dependencies (explicit, local)
   * - `global`  — installed alongside klar itself (e.g. `npm i -g`)
   */
  source: 'project' | 'global';
  /** Plugin ids this package contributed to the registry. */
  ids: string[];
}

/** Optional injection points so discovery is testable without touching globals. */
export interface DiscoverContext {
  cwd: string;
  selfDir: string;
  env: NodeJS.ProcessEnv;
}

function isContrastPlugin(value: unknown): value is ContrastPlugin {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ContrastPlugin).id === 'string' &&
    typeof (value as ContrastPlugin).calculate === 'function'
  );
}

/** True for package names that follow the (scoped or unscoped) plugin convention. */
function isPluginPackageName(name: string): boolean {
  if (FRAMEWORK_PACKAGES.has(name)) return false;
  const unscoped = name.startsWith('@') ? name.slice(name.indexOf('/') + 1) : name;
  return unscoped.startsWith(PLUGIN_PREFIX);
}

/** Walk up from `startDir` to the nearest readable package.json. */
function findNearestPackageJson(startDir: string): { dir: string; pkg: any } | null {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      try {
        return { dir, pkg: JSON.parse(readFileSync(candidate, 'utf8')) };
      } catch {
        // Unreadable/malformed — keep walking up.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The single `node_modules` directory that contains klar's own package.
 * For a global install this is the global root (siblings the user co-installed);
 * for a local install it is the project's node_modules (handled via declared
 * deps instead, so this source is skipped to avoid scanning transitive deps).
 */
function klarEnclosingNodeModules(selfDir: string): string | null {
  const self = findNearestPackageJson(selfDir);
  if (!self) return null;
  const parent = dirname(self.dir);
  return basename(parent) === 'node_modules' ? parent : null;
}

/** Find a package's root from its resolved main entry (exports-map safe). */
function packageRootFromMain(mainPath: string, name: string): string | null {
  let dir = dirname(mainPath);
  for (;;) {
    const pj = join(dir, 'package.json');
    if (existsSync(pj)) {
      try {
        if (JSON.parse(readFileSync(pj, 'utf8')).name === name) return dir;
      } catch {
        // ignore and keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** An on/off env flag where any value other than ''/0/false counts as set. */
function flagOn(value: string | undefined): boolean {
  return value != null && value !== '' && value !== '0' && value.toLowerCase() !== 'false';
}

/**
 * Resolve the plugin allowlist (package names). `KLAR_PLUGINS` takes precedence
 * over the host project's `package.json` `"klar": { "plugins": [...] }`. When an
 * allowlist is present, only the named packages are loaded (opt-out hardening);
 * when absent, all discovered plugins load (the default, convenient behavior).
 */
function resolveAllowlist(env: NodeJS.ProcessEnv, projectPkg: any): Set<string> | null {
  const raw = env.KLAR_PLUGINS;
  if (raw && raw.trim()) {
    return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  }
  const declared = projectPkg?.klar?.plugins;
  if (Array.isArray(declared)) return new Set(declared.map(String));
  return null;
}

/** Resolve, require, and register one plugin package. Returns its load record. */
function loadPluginPackage(
  name: string,
  paths: string[],
  source: PluginLoadRecord['source'],
  registry: PluginRegistry,
  allow: Set<string> | null,
): PluginLoadRecord | null {
  if (allow && !allow.has(name)) return null; // gate BEFORE executing any code

  let mainPath: string;
  try {
    mainPath = require.resolve(name, { paths });
  } catch {
    return null; // declared but not installed, or unresolvable
  }

  const pkgRoot = packageRootFromMain(mainPath, name) ?? dirname(mainPath);
  let version: string | null = null;
  try {
    version = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).version ?? null;
  } catch {
    // version is best-effort
  }

  const ids: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(mainPath);
    const candidates = [mod, mod?.default, ...Object.values(mod ?? {})];
    for (const candidate of candidates) {
      if (isContrastPlugin(candidate)) {
        registry.register(candidate);
        if (!ids.includes(candidate.id)) ids.push(candidate.id);
      }
    }
  } catch {
    // Package present but not loadable as a plugin; skip silently.
  }

  if (ids.length === 0) return null;
  return { packageName: name, version, resolvedPath: pkgRoot, source, ids };
}

/**
 * Discover and register contrast-algorithm plugins — scoped to what the user
 * explicitly installed, to limit supply-chain exposure (see SECURITY.md).
 *
 * Plugins are loaded from exactly two trusted sources, never from an arbitrary
 * walk up the directory tree:
 *   1. the host project's *declared* dependencies (resolved from the project
 *      root) — so transitive deps and unrelated parent projects are NOT loaded;
 *   2. packages installed alongside klar itself (global co-install) — only when
 *      that is a different `node_modules` than the project's.
 *
 * Hardening (opt-out): `KLAR_NO_PLUGINS` disables discovery entirely; an
 * allowlist (`KLAR_PLUGINS` env or `package.json` `klar.plugins`) restricts
 * loading to named packages. The allowlist gates BEFORE a package's code runs.
 *
 * The core hardcodes no plugin names — each plugin self-declares via the
 * ContrastPlugin interface, so the core stays decoupled from any plugin and its
 * dependencies; see PLUGINS.md.
 */
export function discoverPlugins(
  registry: PluginRegistry,
  ctx: DiscoverContext = { cwd: process.cwd(), selfDir: __dirname, env: process.env },
): PluginLoadRecord[] {
  const records: PluginLoadRecord[] = [];
  if (flagOn(ctx.env.KLAR_NO_PLUGINS)) return records;

  const loaded = new Set<string>();
  const project = findNearestPackageJson(ctx.cwd);
  const allow = resolveAllowlist(ctx.env, project?.pkg);

  // Source 1 — host project's declared dependencies (the explicit, local set).
  let projectNodeModules: string | null = null;
  if (project) {
    projectNodeModules = join(project.dir, 'node_modules');
    const declared: Record<string, string> = {
      ...(project.pkg.dependencies ?? {}),
      ...(project.pkg.devDependencies ?? {}),
      ...(project.pkg.optionalDependencies ?? {}),
    };
    for (const name of Object.keys(declared)) {
      if (!isPluginPackageName(name) || loaded.has(name)) continue;
      const rec = loadPluginPackage(name, [project.dir], 'project', registry, allow);
      if (rec) {
        records.push(rec);
        loaded.add(name);
      }
    }
  }

  // Source 2 — packages installed alongside klar (global co-install). Skipped
  // when it is the project's own node_modules (Source 1 already covers that,
  // and a blind scan there would pull in transitive deps).
  const siblingNodeModules = klarEnclosingNodeModules(ctx.selfDir);
  if (siblingNodeModules && siblingNodeModules !== projectNodeModules) {
    let entries: string[] = [];
    try {
      entries = readdirSync(siblingNodeModules);
    } catch {
      entries = [];
    }
    for (const name of entries) {
      if (!isPluginPackageName(name) || loaded.has(name)) continue;
      const rec = loadPluginPackage(name, [siblingNodeModules], 'global', registry, allow);
      if (rec) {
        records.push(rec);
        loaded.add(name);
      }
    }
  }

  return records;
}

/** Wire up services and discover any installed contrast-algorithm plugins. */
function createServices() {
  const pluginRegistry = new PluginRegistry();
  const pluginProvenance = discoverPlugins(pluginRegistry);

  const okcaService = new OkcaService();
  const colorUtilService = new ColorUtilService(okcaService, pluginRegistry);
  const colorMetricsService = new ColorMetricsService(colorUtilService, okcaService, pluginRegistry);

  return { okcaService, colorUtilService, colorMetricsService, pluginRegistry, pluginProvenance };
}

// Singleton instance
let _services: ReturnType<typeof createServices> | null = null;

export function getServices() {
  if (!_services) {
    _services = createServices();
  }
  return _services;
}

export { OkcaService } from './okca.service';
export { ColorUtilService } from './color-util.service';
export { ColorMetricsService } from './color-metrics.service';
export * from './types';
