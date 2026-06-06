import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Core/plugin decoupling guard (structural).
 *
 * Algorithm plugins are loaded at runtime by the `klar-plugin-*` naming
 * convention (see src/services/index.ts and PLUGINS.md); the core never imports
 * one directly. Keeping plugins out of the core's static imports is what lets
 * them stay optional and separately installable — the core has no build- or
 * load-time dependency on any plugin.
 *
 * This test enforces that boundary: no core source file may statically import or
 * require a `klar-plugin-*` package. The first-party framework packages are
 * scoped (`@pawn002/klar-plugin-interface`, `@pawn002/klar-plugin-registry`) and
 * are not matched.
 *
 * Test files and mocks are excluded — they are dev-only.
 */
const SRC_DIR = join(__dirname, '..');
const EXCLUDED_DIRS = new Set(['__tests__', '__mocks__']);

// Matches a static import/require whose specifier begins with the unscoped
// `klar-plugin-` discovery convention. Scoped framework packages (`@pawn002/...`)
// start with `@` and are not matched.
const PLUGIN_IMPORT = /(?:\bfrom|\brequire\(\s*)\s*['"]klar-plugin-/;

function collectCoreSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      collectCoreSourceFiles(full, acc);
    } else if (entry.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('core stays decoupled from algorithm plugins', () => {
  it('no core source file statically imports a klar-plugin-* package', () => {
    const offenders: string[] = [];
    for (const file of collectCoreSourceFiles(SRC_DIR)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (PLUGIN_IMPORT.test(line)) {
            offenders.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
