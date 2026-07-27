import { Command } from 'commander';
import { contrastCommand } from './commands/contrast';
import { metaCommand } from './commands/meta';
import { pairCommand } from './commands/pair';
import { variantsCommand } from './commands/variants';
import { matchCommand } from './commands/match';
import { lightnessCommand } from './commands/lightness';
import { findCommand } from './commands/find';
import { pluginsCommand } from './commands/plugins';

const pkg = require('../package.json');

/**
 * Bring commander's own argument errors under the documented exit-code
 * contract (see utils/output.ts).
 *
 * commander defaults every parse error — unknown option, unknown command,
 * missing argument, missing required option — to exit code 1, which is klar's
 * *soft failure* code. That makes `klar find --targt 4.5` indistinguishable
 * from "no color meets the target" to a script branching on `$?`. These are
 * usage errors, so they exit 2 like `errorOut`, and their `error:` prefix is
 * normalized to `Error:` to match it.
 *
 * Terminations commander already marks as successful (`--help`, `--version`)
 * carry exitCode 0 and stay 0.
 *
 * Applied recursively: `addCommand()` does not call `copyInheritedSettings()`
 * the way `.command()` does, so each subcommand needs this set on it directly
 * or it keeps commander's defaults.
 */
function applyExitCodeContract(cmd: Command): void {
  cmd.exitOverride((err) => process.exit(err.exitCode === 0 ? 0 : 2));
  cmd.configureOutput({
    outputError: (str, write) => write(str.replace(/^error:/, 'Error:')),
  });
  cmd.commands.forEach(applyExitCodeContract);
}

export function run(): void {
  const program = new Command();

  program
    .name('klar')
    .description('klar — color accessibility tools (OKCA contrast algorithm) for AI coding agents and the terminal')
    .version(pkg.version, '-v, --version')
    .option('--no-plugins', 'Disable discovery of contrast-algorithm plugins (security: run core only)');

  // Honor --no-plugins before any command builds its services (and discovers
  // plugins). commander sets opts.plugins === false when the flag is present.
  program.hook('preAction', (thisCommand) => {
    if (thisCommand.opts().plugins === false) process.env.KLAR_NO_PLUGINS = '1';
  });

  program.addCommand(contrastCommand());
  program.addCommand(pairCommand());
  program.addCommand(variantsCommand());
  program.addCommand(metaCommand());
  program.addCommand(matchCommand());
  program.addCommand(lightnessCommand());
  program.addCommand(findCommand());
  program.addCommand(pluginsCommand());

  // After every command is registered, so the walk reaches all of them.
  applyExitCodeContract(program);

  program.parse(process.argv);
}
