import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { errorOut } from '../utils/output';
import { PLAYBOOK_PATH } from '../utils/package-files';

/**
 * `klar playbook` prints the agent playbook that ships inside the package.
 *
 * The shipped skill points agents here instead of at a file path, because the
 * path differs by install method: `node_modules/klar-cli/` for a local
 * dependency, somewhere under the global prefix for `npm install -g`, and a
 * cache directory for `npx`. The command resolves it the same way every time.
 */
export function playbookCommand(): Command {
  return new Command('playbook')
    .description('Print the agent playbook (AGENT_PLAYBOOK.md) shipped with this klar')
    .option('--path', 'Print only the playbook file path', false)
    .action((opts: { path: boolean }) => {
      if (!existsSync(PLAYBOOK_PATH)) {
        errorOut(`playbook not found at ${PLAYBOOK_PATH}; this klar install is incomplete`);
      }
      if (opts.path) {
        process.stdout.write(PLAYBOOK_PATH + '\n');
        return;
      }
      process.stdout.write(readFileSync(PLAYBOOK_PATH, 'utf8'));
    });
}
