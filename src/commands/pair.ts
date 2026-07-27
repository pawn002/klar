import { Command } from 'commander';
import { getServices } from '../services';
import { output, errorOut, OutputOptions } from '../utils/output';
import { formatPair } from '../formatters/human';

export function pairCommand(): Command {
  const cmd = new Command('pair')
    .description('Generate a random accessible color pair')
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print only the two hex values', false)
    .addHelpText('after', `
Examples:
  $ klar pair
  $ klar pair --json
  $ klar pair -q`)
    .action(async (opts: { json: boolean; quiet: boolean }) => {
      const outputOpts: OutputOptions = { json: opts.json, quiet: opts.quiet };

      const { colorUtilService, colorMetricsService } = getServices();
      const pair = colorUtilService.getRandomColorPair();
      const contrast = colorMetricsService.calcRawOkcaContrast(pair[0], pair[1]);
      const okcaScore = contrast !== null ? parseInt(contrast.toFixed(0)) : 0;

      const data = { colorOne: pair[0], colorTwo: pair[1], contrast: okcaScore };
      if (opts.quiet) output({ quietValue: `${pair[0]} ${pair[1]}` }, outputOpts);
      else if (opts.json) output(data, outputOpts);
      else output(formatPair(data), outputOpts);
    });

  return cmd;
}
