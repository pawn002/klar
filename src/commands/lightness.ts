import { Command } from 'commander';
import { getServices } from '../services';
import { output, errorOut, OutputOptions } from '../utils/output';
import { formatLightness } from '../formatters/human';

export function lightnessCommand(): Command {
  return new Command('lightness')
    .description('Get min/max lightness range for a color in sRGB gamut')
    .argument('<color>', 'Color to analyze (hex, rgb, oklch)')
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print min max space-separated', false)
    .addHelpText('after', `
Examples:
  $ klar lightness "#3b82f6"
  $ klar lightness "#3b82f6" --json
  $ klar lightness "#3b82f6" -q`)
    .action((color: string, opts: { json: boolean; quiet: boolean }) => {
      const { colorUtilService } = getServices();

      if (!colorUtilService.parseColor(color)) errorOut(`Invalid color: ${color}`);

      const result = colorUtilService.getMinMaxLight(color);
      if (!result) errorOut('Unable to calculate lightness range');

      const outputOpts: OutputOptions = { json: opts.json, quiet: opts.quiet };

      if (opts.quiet) {
        output({ quietValue: `${result!.lightMin.toFixed(4)} ${result!.lightMax.toFixed(4)}` }, outputOpts);
      } else if (opts.json) {
        output({
          originalCoords: result!.originalCoords,
          lightMin: result!.lightMin,
          lightMax: result!.lightMax,
        }, outputOpts);
      } else {
        output(formatLightness({
          originalCoords: result!.originalCoords,
          lightMin: result!.lightMin,
          lightMax: result!.lightMax,
          color,
        }), outputOpts);
      }
    });
}
