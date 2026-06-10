#!/usr/bin/env node
// prepare-publish.mjs — flip internal `file:` workspace deps to real `^<version>`
// ranges immediately before `npm publish`.
//
// Why: klar core is three packages that depend on each other. For local dev those
// internal deps are declared as `file:` links so edits propagate without a publish.
// But a `file:` path is meaningless to anyone installing off the registry, so they
// must be rewritten to a published version range at publish time. This is the
// "flip" half of the flip-and-order publish sequence (order is enforced by the
// publish workflow, not here).
//
// Design notes:
//   - Surgical text edit: only the version string of each known internal dep is
//     rewritten. All other bytes (indentation, single-line arrays, trailing
//     newline) are preserved, so the diff is exactly the lines that changed.
//   - Loud, not silent: if an expected dependency key is missing (e.g. a rename),
//     the script throws instead of no-op'ing — a silent skip would publish a broken
//     `file:` tarball to an immutable registry.
//   - Idempotent: a dep already at `^<version>` is simply rewritten to the same
//     value, so re-running (or running on an already-flipped tree) is safe.
//
// The committed tree intentionally stays on `file:` for local dev. CI runs this on a
// throwaway checkout; locally, `git checkout -- .` restores the links afterward.
//
// Usage:  node scripts/prepare-publish.mjs          (flip; default)
//         node scripts/prepare-publish.mjs --check   (verify no internal file: deps remain; exit 1 if any)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const abs = (rel) => join(repoRoot, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));

const INTERFACE = '@pawn002/klar-plugin-interface';
const REGISTRY = '@pawn002/klar-plugin-registry';

// version source of truth = each package's own `version` field
const interfaceVer = readJson('packages/plugin-interface/package.json').version;
const registryVer = readJson('packages/plugin-registry/package.json').version;

// which internal deps to flip, per manifest, and to what range
const targets = [
  { file: 'packages/plugin-registry/package.json', deps: { [INTERFACE]: interfaceVer } },
  { file: 'package.json', deps: { [INTERFACE]: interfaceVer, [REGISTRY]: registryVer } },
];

const checkOnly = process.argv.includes('--check');

/** Replace the JSON string value of `"<dep>": "<anything>"` with `"^<version>"`. */
function flipDep(text, dep, version) {
  // match the key, the colon/space, then a double-quoted value
  const re = new RegExp(`("${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*)"[^"]*"`, 'g');
  const matches = text.match(re);
  if (!matches) throw new Error(`expected dependency "${dep}" not found — did it get renamed or removed?`);
  if (matches.length > 1) throw new Error(`dependency "${dep}" appears ${matches.length}x — ambiguous, refusing to flip`);
  return text.replace(re, `$1"^${version}"`);
}

let changed = 0;
let stale = 0;
for (const { file, deps } of targets) {
  const before = readFileSync(abs(file), 'utf8');
  if (checkOnly) {
    for (const dep of Object.keys(deps)) {
      const re = new RegExp(`"${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*"file:[^"]*"`);
      if (re.test(before)) {
        console.error(`✗ ${file}: ${dep} still on file: link`);
        stale++;
      }
    }
    continue;
  }
  let after = before;
  for (const [dep, version] of Object.entries(deps)) after = flipDep(after, dep, version);
  if (after !== before) {
    writeFileSync(abs(file), after);
    changed++;
    console.log(`✓ ${file}: flipped ${Object.keys(deps).join(', ')}`);
  } else {
    console.log(`· ${file}: already flipped (no change)`);
  }
}

if (checkOnly) {
  if (stale > 0) {
    console.error(`\n${stale} internal file: dep(s) remain — not publish-ready.`);
    process.exit(1);
  }
  console.log('✓ no internal file: deps remain — publish-ready.');
} else {
  console.log(`\nFlipped ${changed} manifest(s) to interface@^${interfaceVer}, registry@^${registryVer}.`);
  console.log('Reminder: committed tree should stay on file: — restore with `git checkout -- .` after a local publish.');
}
