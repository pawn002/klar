import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';

/**
 * `klar playbook` and `klar skill`, verified end to end through the built CLI.
 * Requires `npm run build` (asserts dist/bin/klar.js), like cli-exit-codes.spec.ts.
 */
const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'dist/bin/klar.js');
const SKILL = path.join(ROOT, 'skills/klar/SKILL.md');
const PLAYBOOK = path.join(ROOT, 'AGENT_PLAYBOOK.md');

function run(args: string[], opts: { cwd?: string; home?: string } = {}) {
  const env = { ...process.env };
  if (opts.home) {
    env.HOME = opts.home;
    env.USERPROFILE = opts.home;
  }
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: opts.cwd ?? ROOT, env });
  return { code: r.status ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const built = existsSync(CLI);
const d = built ? describe : describe.skip;
if (!built) {
  // eslint-disable-next-line no-console
  console.warn(`Skipping playbook/skill specs — ${CLI} not found. Run "npm run build" first.`);
}

d('klar playbook', () => {
  it('prints the shipped playbook', () => {
    const r = run(['playbook']);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(readFileSync(PLAYBOOK, 'utf8'));
  });

  it('--path prints the location of the shipped playbook', () => {
    const r = run(['playbook', '--path']);
    expect(r.code).toBe(0);
    expect(path.resolve(r.stdout.trim())).toBe(PLAYBOOK);
  });
});

d('klar skill', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'klar-skill-'));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const dest = (base: string) => path.join(base, '.claude', 'skills', 'klar', 'SKILL.md');

  it('show prints the shipped SKILL.md', () => {
    const r = run(['skill', 'show']);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(readFileSync(SKILL, 'utf8'));
  });

  it('install writes the skill into the current project', () => {
    const r = run(['skill', 'install', '--json'], { cwd: tmp });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ path: dest(tmp), action: 'installed' });
    expect(readFileSync(dest(tmp), 'utf8')).toBe(readFileSync(SKILL, 'utf8'));
  });

  it('install is idempotent', () => {
    run(['skill', 'install'], { cwd: tmp });
    const r = run(['skill', 'install', '--json'], { cwd: tmp });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).action).toBe('unchanged');
  });

  it('does not overwrite a customized skill without --force (exit 1)', () => {
    mkdirSync(path.dirname(dest(tmp)), { recursive: true });
    writeFileSync(dest(tmp), 'custom\n');
    const r = run(['skill', 'install', '--json'], { cwd: tmp });
    expect(r.code).toBe(1);
    expect(JSON.parse(r.stdout).action).toBe('skipped');
    expect(readFileSync(dest(tmp), 'utf8')).toBe('custom\n');

    const forced = run(['skill', 'install', '--force', '--json'], { cwd: tmp });
    expect(forced.code).toBe(0);
    expect(JSON.parse(forced.stdout).action).toBe('updated');
    expect(readFileSync(dest(tmp), 'utf8')).toBe(readFileSync(SKILL, 'utf8'));
  });

  it('--user installs under the home directory', () => {
    const home = mkdtempSync(path.join(os.tmpdir(), 'klar-home-'));
    try {
      const r = run(['skill', 'install', '--user', '-q'], { cwd: tmp, home });
      expect(r.code).toBe(0);
      expect(r.stdout.trim()).toBe(dest(home));
      expect(existsSync(dest(home))).toBe(true);
      expect(existsSync(dest(tmp))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('shipped SKILL.md', () => {
  const text = readFileSync(SKILL, 'utf8');
  const frontmatter = text.split('---')[1];

  it('has a quoted description, so strict YAML parsers accept it', () => {
    // The description contains ": ", which is invalid in an unquoted YAML scalar.
    expect(frontmatter).toMatch(/^name: klar$/m);
    expect(frontmatter).toMatch(/^description: ".*"$/m);
  });

  it('keeps the description that was evaluated (evals/skill-vs-playbook, arm A4)', () => {
    const arms = readFileSync(path.join(ROOT, 'evals/skill-vs-playbook/arms.mjs'), 'utf8');
    const block = arms.slice(arms.indexOf('export const SKILL_DESCRIPTION ='));
    const evaluated = [...block.slice(0, block.indexOf(';')).matchAll(/"((?:[^"\\]|\\.)*)"/g)]
      .map((m) => m[1])
      .join('');
    const shipped = frontmatter.match(/^description: "(.*)"$/m)?.[1];
    expect(shipped).toBe(evaluated);
  });

  it('points agents at `klar playbook`, which resolves for every install method', () => {
    expect(text).toContain('`klar playbook`');
  });
});
