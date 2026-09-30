import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { errorOut, markFailure, output, OutputOptions } from '../utils/output';
import { SKILL_PATH } from '../utils/package-files';

/**
 * `klar skill` installs the Agent Skill that ships inside the package.
 *
 * Why a skill rather than a CLAUDE.md snippet: in klar's eval
 * (evals/skill-vs-playbook), a CLAUDE.md pointer led agents to the playbook in
 * 0 of 69 trials, while a skill pointing to it loaded in 69 of 69.
 */
export function skillCommand(): Command {
  return new Command('skill')
    .description('Install or print the klar Agent Skill')
    .addCommand(installSubcommand())
    .addCommand(showSubcommand());
}

type InstallAction = 'installed' | 'updated' | 'unchanged' | 'skipped';

function installSubcommand(): Command {
  return new Command('install')
    .description(
      'Write the klar skill to .claude/skills/klar/SKILL.md in the current project ' +
        '(or in your user skills folder with --user)',
    )
    .option('--user', 'Install for your user (~/.claude/skills) instead of this project', false)
    .option('--force', 'Overwrite an existing SKILL.md that differs from the shipped one', false)
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print only the installed file path', false)
    .action((opts: { user: boolean; force: boolean; json: boolean; quiet: boolean }) => {
      const shipped = readShippedSkill();
      const base = opts.user ? os.homedir() : process.cwd();
      const dest = path.join(base, '.claude', 'skills', 'klar', 'SKILL.md');
      const outputOpts: OutputOptions = { json: opts.json, quiet: opts.quiet };

      let action: InstallAction;
      if (!existsSync(dest)) {
        action = 'installed';
      } else if (readFileSync(dest, 'utf8') === shipped) {
        action = 'unchanged';
      } else {
        action = opts.force ? 'updated' : 'skipped';
      }

      if (action === 'installed' || action === 'updated') {
        mkdirSync(path.dirname(dest), { recursive: true });
        writeFileSync(dest, shipped);
      }

      const message = {
        installed: `Installed the klar skill: ${dest}`,
        updated: `Updated the klar skill: ${dest}`,
        unchanged: `The klar skill is already up to date: ${dest}`,
        skipped: `Not overwritten: ${dest} differs from the shipped skill. Re-run with --force to replace it.`,
      }[action];

      output(opts.json ? { path: dest, action } : opts.quiet ? { quietValue: dest } : message, outputOpts);

      // Leaving a customized file alone is a valid operation with a negative
      // answer: exit 1, per the exit-code contract in utils/output.ts.
      if (action === 'skipped') markFailure();
    });
}

function showSubcommand(): Command {
  return new Command('show')
    .description('Print the shipped SKILL.md, e.g. to install it for an agent other than Claude Code')
    .action(() => {
      process.stdout.write(readShippedSkill());
    });
}

function readShippedSkill(): string {
  if (!existsSync(SKILL_PATH)) {
    errorOut(`skill not found at ${SKILL_PATH}; this klar install is incomplete`);
  }
  return readFileSync(SKILL_PATH, 'utf8');
}
