import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { OkcaService } from './okca.service';
import { ColorUtilService } from './color-util.service';
import { ColorMetricsService } from './color-metrics.service';
import { PluginRegistry } from '@pawn002/klar-plugin-registry';
import type { ContrastPlugin } from '@pawn002/klar-plugin-interface';

const PLUGIN_PREFIX = 'klar-plugin-';

function isContrastPlugin(value: unknown): value is ContrastPlugin {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ContrastPlugin).id === 'string' &&
    typeof (value as ContrastPlugin).calculate === 'function'
  );
}

/**
 * Discover and register contrast-algorithm plugins by convention.
 *
 * Scans `node_modules` directories (walking up from this module) for
 * packages named `klar-plugin-*` and registers any ContrastPlugin they
 * export. The core hardcodes no plugin names — each plugin
 * self-declares its id/displayName via the ContrastPlugin interface, so
 * the core stays decoupled from any plugin and its dependencies; see
 * PLUGINS.md.
 */
function discoverPlugins(registry: PluginRegistry): void {
  const seen = new Set<string>();
  let dir = __dirname;
  for (let depth = 0; depth < 12; depth++) {
    const nodeModules = join(dir, 'node_modules');
    let entries: string[] = [];
    try {
      entries = readdirSync(nodeModules);
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.startsWith(PLUGIN_PREFIX) || seen.has(entry)) continue;
      seen.add(entry);
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(join(nodeModules, entry));
        const candidates = [mod, mod?.default, ...Object.values(mod ?? {})];
        for (const candidate of candidates) {
          if (isContrastPlugin(candidate)) registry.register(candidate);
        }
      } catch {
        // Package present but not loadable as a plugin; skip silently.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

/** Wire up services and discover any installed contrast-algorithm plugins. */
function createServices() {
  const pluginRegistry = new PluginRegistry();
  discoverPlugins(pluginRegistry);

  const okcaService = new OkcaService();
  const colorUtilService = new ColorUtilService(okcaService, pluginRegistry);
  const colorMetricsService = new ColorMetricsService(colorUtilService, okcaService, pluginRegistry);

  return { okcaService, colorUtilService, colorMetricsService, pluginRegistry };
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
