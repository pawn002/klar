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

export function run(): void {
  const program = new Command();

  program
    .name('klar')
    .description('klar — color accessibility tools (OKCA contrast algorithm) for AI coding agents and the terminal')
    .version(pkg.version, '-v, --version')

  program.addCommand(contrastCommand());
  program.addCommand(pairCommand());
  program.addCommand(variantsCommand());
  program.addCommand(metaCommand());
  program.addCommand(matchCommand());
  program.addCommand(lightnessCommand());
  program.addCommand(findCommand());
  program.addCommand(pluginsCommand());

  program.parse(process.argv);
}
