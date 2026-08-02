import { Command } from 'commander';
import { getServices } from '../services';
import { output, errorOut, markFailure, OutputOptions } from '../utils/output';
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
      const { originalCoords, lightMin, lightMax, outOfGamut } = result!;
      const emptyRange = lightMin === null || lightMax === null;

      if (opts.quiet) {
        // Nothing to print when there is no range — a pair of numbers here would
        // be the defect this replaced. Exit 1 and the stderr note carry it.
        if (!emptyRange) {
          output({ quietValue: `${lightMin!.toFixed(4)} ${lightMax!.toFixed(4)}` }, outputOpts);
        }
      } else if (opts.json) {
        output({ originalCoords, lightMin, lightMax, gamut: { outOfGamut } }, outputOpts);
      } else {
        output(formatLightness({ originalCoords, lightMin, lightMax, outOfGamut, color }), outputOpts);
      }

      if (emptyRange) {
        markFailure(
          `klar: no lightness renders ${color} at chroma ${originalCoords[1].toFixed(4)}; ` +
            `reduce chroma for a usable range`,
        );
      }
    });
}
