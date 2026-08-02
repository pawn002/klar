import { execFileSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Exit-code contract (grep-style), verified end-to-end through the built CLI:
 *   0 — success (satisfying result)
 *   1 — soft failure (valid op, negative result: find unachievable, match infeasible)
 *   2 — usage / input error (invalid color)
 *
 * Requires `npm run build` (these assert behavior of dist/bin/klar.js, which is
 * where the contract actually lives — command actions set process exit codes).
 */
const CLI = path.resolve(__dirname, '../../dist/bin/klar.js');

/** Run the CLI and return its exit code (0 on clean exit). */
function exitCode(args: string[]): number {
  try {
    execFileSync(process.execPath, [CLI, ...args], { stdio: 'pipe' });
    return 0;
  } catch (err) {
    return (err as { status: number }).status;
  }
}

/** Run the CLI and return its trimmed stderr. */
function stderrOf(args: string[]): string {
  try {
    execFileSync(process.execPath, [CLI, ...args], { stdio: 'pipe' });
    return '';
  } catch (err) {
    return ((err as { stderr: Buffer }).stderr?.toString() ?? '').trim();
  }
}

/**
 * Run the CLI and return { code, stdout, stderr }.
 *
 * `spawnSync` rather than `execFileSync` because stderr has become load-bearing:
 * out-of-gamut notes go there specifically so `-q` keeps a bare number on
 * stdout, and `execFileSync` only surfaces stderr on a non-zero exit.
 */
function run(args: string[]): { code: number; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { code: r.status ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const DARK_BG = 'oklch(0.24 0.03 248.99)';
const NEUTRAL_BG = 'oklch(0.50 0 0)';
// colorjs.io emits 3-digit shorthand when it can (#fff, #eee), so `find` may
// print either form — the point of the assertion is that it prints a color.
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;
// A pair where neither color can adopt the other's chroma within sRGB.
const INFEASIBLE = ['oklch(0.98 0.16 100)', 'oklch(0.20 0.18 280)'];

const built = existsSync(CLI);
const d = built ? describe : describe.skip;
if (!built) {
  // eslint-disable-next-line no-console
  console.warn(`Skipping CLI exit-code specs — ${CLI} not found. Run "npm run build" first.`);
}

d('CLI exit-code contract', () => {
  describe('0 = success', () => {
    it.each([
      ['find human', ['find', DARK_BG, '#808080', '--target', '3.0']],
      ['find quiet', ['find', DARK_BG, '#808080', '--target', '3.0', '-q']],
      ['find json', ['find', DARK_BG, '#808080', '--target', '3.0', '--json']],
      ['match human', ['match', '#ff6600', '#3b82f6']],
    ])('%s exits 0', (_label, args) => {
      expect(exitCode(args as string[])).toBe(0);
    });
  });

  // A `--target` of 21 is above okca 2.0.0's light-on-dark cap (20.9), so it is
  // unreachable for any pair — a stable fixture for the unachievable branch.
  describe('1 = soft failure (negative result)', () => {
    it.each([
      ['find unachievable human', ['find', NEUTRAL_BG, '#808080', '--target', '21']],
      ['find unachievable quiet', ['find', NEUTRAL_BG, '#808080', '--target', '21', '-q']],
      ['find unachievable json', ['find', NEUTRAL_BG, '#808080', '--target', '21', '--json']],
      ['match infeasible human', ['match', INFEASIBLE[0], INFEASIBLE[1]]],
      ['match infeasible quiet', ['match', INFEASIBLE[0], INFEASIBLE[1], '-q']],
      ['match infeasible json', ['match', INFEASIBLE[0], INFEASIBLE[1], '--json']],
    ])('%s exits 1', (_label, args) => {
      expect(exitCode(args as string[])).toBe(1);
    });

    it('find still prints the closest color to stdout on soft failure', () => {
      const { code, stdout } = run(['find', NEUTRAL_BG, '#808080', '--target', '21', '-q']);
      expect(code).toBe(1);
      expect(stdout.trim()).toMatch(HEX);
    });

    it('find --json reports success:false on soft failure', () => {
      const { code, stdout } = run(['find', NEUTRAL_BG, '#808080', '--target', '21', '--json']);
      expect(code).toBe(1);
      expect(JSON.parse(stdout).success).toBe(false);
    });
  });

  // An out-of-gamut input is measured as its mapped equivalent, which is a real
  // answer to a different question than the one asked. Exit 1 stops it being
  // adopted silently — the same mechanism that already protects `find`.
  describe('1 = out-of-gamut input on contrast', () => {
    const OOG = 'oklch(0.79 0.22 25)';
    const BG = '#070e16';

    it.each([
      ['human', ['contrast', OOG, BG]],
      ['quiet', ['contrast', OOG, BG, '-q']],
      ['json', ['contrast', OOG, BG, '--json']],
    ])('%s exits 1', (_label, args) => {
      expect(exitCode(args as string[])).toBe(1);
    });

    it('still writes the number to stdout so it can be inspected', () => {
      const { code, stdout } = run(['contrast', OOG, BG, '-q']);
      expect(code).toBe(1);
      expect(Number(stdout.trim())).toBeGreaterThan(0);
    });

    it('names the offending color on stderr, keeping stdout a bare number', () => {
      const { stdout, stderr } = run(['contrast', OOG, BG, '-q']);
      expect(stdout.trim()).toMatch(/^[\d.]+$/);
      expect(stderr).toContain(OOG);
      expect(stderr).toMatch(/#[0-9a-f]{6}/i);
    });

    it('--allow-out-of-gamut waives the failure', () => {
      expect(exitCode(['contrast', OOG, BG, '-q', '--allow-out-of-gamut'])).toBe(0);
    });

    it('still reports outOfGamut when the failure is waived', () => {
      const { stdout } = run(['contrast', OOG, BG, '--json', '--allow-out-of-gamut']);
      expect(JSON.parse(stdout).gamut.outOfGamut).toBe(true);
    });

    it('in-gamut colors are unaffected', () => {
      expect(exitCode(['contrast', '#ffffff', '#000000', '-q'])).toBe(0);
    });

    it('no mapping mode silences the signal', () => {
      // Environment can change what klar measures against; nothing in the
      // environment can turn a mapped measurement into a quiet one.
      for (const map of ['css', 'clip']) {
        expect(exitCode(['contrast', OOG, BG, '-q', '--gamut-map', map])).toBe(1);
      }
    });
  });

  describe('2 = usage / input error', () => {
    it.each([
      ['contrast bad input', ['contrast', 'notacolor', '#000']],
      ['find bad input', ['find', 'nope', '#000', '--target', '3']],
      ['match bad input', ['match', 'nope', '#000']],
    ])('%s exits 2', (_label, args) => {
      expect(exitCode(args as string[])).toBe(2);
    });

    // commander defaults its own parse errors to exit 1, which is klar's
    // soft-failure code. They are routed to 2 so a script branching on `$?`
    // can tell "you typed it wrong" from "no answer exists".
    it.each([
      ['unknown option',          ['pair', '--min-lightness', '40']],
      ['unknown option on subcmd', ['contrast', '#fff', '#000', '--nope']],
      ['unknown command',         ['bogus']],
      ['unknown nested command',  ['plugins', 'bogus']],
      ['missing required option', ['find', '#fff', '#000']],
      ['option missing its value', ['find', '#fff', '#000', '--target']],
      ['missing argument',        ['contrast', '#fff']],
      ['no command at all',       []],
    ])('%s exits 2', (_label, args) => {
      expect(exitCode(args as string[])).toBe(2);
    });

    it('reports usage errors on stderr with the same Error: prefix as input errors', () => {
      const fromCommander = stderrOf(['pair', '--min-lightness', '40']);
      const fromKlar = stderrOf(['contrast', 'notacolor', '#000']);
      expect(fromCommander).toMatch(/^Error: /);
      expect(fromKlar).toMatch(/^Error: /);
    });

    // The property a pipeline actually depends on: a usage error never puts
    // anything on the data channel, so `1` is the only code that can carry a
    // payload. `klar` with no command prints help to stderr, not stdout.
    it.each([
      ['unknown option',   ['pair', '--min-lightness', '40']],
      ['unknown command',  ['bogus']],
      ['missing argument', ['contrast', '#fff']],
      ['bad color value',  ['contrast', 'notacolor', '#000']],
      ['no command at all', []],
    ])('%s writes nothing to stdout', (_label, args) => {
      const { code, stdout } = run(args as string[]);
      expect(code).toBe(2);
      expect(stdout).toBe('');
    });
  });

  describe('0 = help and version are not errors', () => {
    it.each([
      ['top-level help',   ['--help']],
      ['version',          ['--version']],
      ['subcommand help',  ['contrast', '--help']],
      ['nested help',      ['plugins', 'list', '--help']],
      ['help subcommand',  ['help', 'contrast']],
    ])('%s exits 0', (_label, args) => {
      expect(exitCode(args as string[])).toBe(0);
    });
  });
});
