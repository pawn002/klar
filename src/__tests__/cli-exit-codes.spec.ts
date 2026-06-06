import { execFileSync } from 'child_process';
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

/** Run the CLI and return { code, stdout }. */
function run(args: string[]): { code: number; stdout: string } {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { stdio: 'pipe' }).toString();
    return { code: 0, stdout };
  } catch (err) {
    const e = err as { status: number; stdout: Buffer };
    return { code: e.status, stdout: e.stdout?.toString() ?? '' };
  }
}

const DARK_BG = 'oklch(0.24 0.03 248.99)';
const NEUTRAL_BG = 'oklch(0.50 0 0)';
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
      expect(stdout.trim()).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('find --json reports success:false on soft failure', () => {
      const { code, stdout } = run(['find', NEUTRAL_BG, '#808080', '--target', '21', '--json']);
      expect(code).toBe(1);
      expect(JSON.parse(stdout).success).toBe(false);
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
  });
});
