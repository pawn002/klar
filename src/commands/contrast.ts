import { Command } from 'commander';
import { getServices } from '../services';
import { ContrastType } from '../services/types';
import { output, errorOut, OutputOptions } from '../utils/output';
import { formatContrast } from '../formatters/human';
import { PLUGIN_DOCS_URL } from '../constants';

export function contrastCommand(): Command {
  const cmd = new Command('contrast')
    .description('Calculate contrast between a foreground and a background. OKCA is polarity-aware — argument order matters (some plugins are too).')
    .argument('<foreground>', 'Foreground color (hex, rgb, oklch)')
    .argument('<background>', 'Background color (hex, rgb, oklch)')
    .option('-t, --type <type>', 'Algorithm: okca, wcag2, deltaE (built-in), plus any installed contrast-algorithm plugins', 'okca')
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print only the numeric value', false)
    .addHelpText('after', `
Examples:
  $ klar contrast "#fff" "#000"
  $ klar contrast "#fff" "#000" --type wcag2
  $ klar contrast "oklch(50% 0.2 240)" "#000" -q
  $ klar contrast "#fff" "#000" --type okca --json`)
    .action(async (color1: string, color2: string, opts: { type: string; json: boolean; quiet: boolean }) => {
      const { pluginRegistry } = getServices();
      const validTypes: string[] = ['okca', 'wcag2', 'deltaE', ...pluginRegistry.ids()];
      if (!validTypes.includes(opts.type)) {
        errorOut(
          `Unknown contrast type "${opts.type}".\n` +
            `Available types: ${validTypes.join(', ')}\n` +
            `Additional algorithms may be available as plugins — see ${PLUGIN_DOCS_URL}`,
        );
      }
      const contrastType: ContrastType = opts.type;
      const outputOpts: OutputOptions = { json: opts.json, quiet: opts.quiet };

      const { colorMetricsService, colorUtilService } = getServices();
      if (!colorUtilService.parseColor(color1)) errorOut(`Invalid color: ${color1}`);
      if (!colorUtilService.parseColor(color2)) errorOut(`Invalid color: ${color2}`);

      const contrast = colorMetricsService.getContrast(color1, color2, contrastType);
      if (contrast === null) errorOut('Unable to calculate contrast for the given colors');

      const plugin = pluginRegistry.get(contrastType);
      const data = {
        contrast: contrast!,
        type: contrastType,
        colorOne: color1,
        colorTwo: color2,
        unit: plugin?.unit,
        category: plugin?.category,
      };
      if (opts.quiet) output({ quietValue: contrast }, outputOpts);
      else if (opts.json) output(data, outputOpts);
      else output(formatContrast(data), outputOpts);
    });

  return cmd;
}
