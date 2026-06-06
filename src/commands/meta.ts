import { Command } from 'commander';
import { getServices } from '../services';
import { output, errorOut, OutputOptions } from '../utils/output';
import { formatMeta } from '../formatters/human';

export function metaCommand(): Command {
  const cmd = new Command('meta')
    .description('Get OKLCH metadata for a color')
    .argument('<color>', 'Color to analyze (hex, rgb, oklch)')
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print L C H values space-separated', false)
    .addHelpText('after', `
Examples:
  $ klar meta "#3b82f6"
  $ klar meta "rgb(59, 130, 246)"
  $ klar meta "#3b82f6" --json
  $ klar meta "#3b82f6" -q`)
    .action(async (color: string, opts: { json: boolean; quiet: boolean }) => {
      const outputOpts: OutputOptions = { json: opts.json, quiet: opts.quiet };

      const { colorUtilService } = getServices();
      if (!colorUtilService.parseColor(color)) errorOut(`Invalid color: ${color}`);

      const meta = colorUtilService.getColorMeta(color);
      if (!meta) errorOut('Unable to get color metadata');

      const data = { color, ...meta };
      if (opts.quiet) output({ quietValue: `${meta!.lightness} ${meta!.chroma} ${meta!.hue}` }, outputOpts);
      else if (opts.json) output(data, outputOpts);
      else output(formatMeta(data as Parameters<typeof formatMeta>[0]), outputOpts);
    });

  return cmd;
}
