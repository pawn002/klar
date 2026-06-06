import { Command } from 'commander';
import { getServices } from '../services';
import { output, errorOut, markFailure, OutputOptions } from '../utils/output';
import { formatMatchChromas } from '../formatters/human';

export function matchCommand(): Command {
  return new Command('match')
    .description('Match chroma values between two colors')
    .argument('<color1>', 'First color (hex, rgb, oklch)')
    .argument('<color2>', 'Second color (hex, rgb, oklch)')
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print only the matched hex values', false)
    .addHelpText('after', `
Examples:
  $ klar match "#ff6600" "#3b82f6"
  $ klar match "#ff6600" "#3b82f6" --json`)
    .action((color1: string, color2: string, opts: { json: boolean; quiet: boolean }) => {
      const { colorUtilService } = getServices();

      if (!colorUtilService.parseColor(color1)) errorOut(`Invalid color: ${color1}`);
      if (!colorUtilService.parseColor(color2)) errorOut(`Invalid color: ${color2}`);

      const result = colorUtilService.matchChromas([color1, color2]);

      const outputOpts: OutputOptions = { json: opts.json, quiet: opts.quiet };

      if (opts.quiet) {
        // No best-effort value to emit on failure — keep stdout clean, note on stderr.
        if (result.colors) {
          output({ quietValue: `${result.colors[0]} ${result.colors[1]}` }, outputOpts);
        }
      } else if (opts.json) {
        output({
          success: result.success,
          colors: result.colors,
          chroma: result.chroma,
        }, outputOpts);
      } else {
        output(formatMatchChromas({
          success: result.success,
          colors: result.colors as [string, string] | null,
          chroma: result.chroma,
        }), outputOpts);
      }

      // Soft failure (chroma match infeasible): exit 1 consistently across modes.
      if (!result.success) markFailure(opts.quiet ? 'Chroma matching failed' : undefined);
    });
}
