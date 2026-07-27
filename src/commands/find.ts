import { Command } from 'commander';
import { getServices } from '../services';
import { ContrastType } from '../services/types';
import { output, errorOut, markFailure, OutputOptions } from '../utils/output';
import { formatFind } from '../formatters/human';
import { PLUGIN_DOCS_URL } from '../constants';

export function findCommand(): Command {
  const cmd = new Command('find')
    .description('Find a color that meets a target contrast by adjusting lightness')
    .argument('<base-color>', 'Color to keep fixed')
    .argument('<reference-color>', 'Color to adjust')
    .requiredOption('--target <n>', 'Target contrast value (required)', parseFloat)
    .option('-t, --type <type>', 'Algorithm: okca, wcag2, deltaE (built-in), plus any installed contrast-algorithm plugins', 'okca')
    .option('--tolerance <n>', 'Acceptable overshoot above the target (never accepts below it)', parseFloat, 0.5)
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print only the adjusted color hex', false)
    .addHelpText('after', `
Only lightness is adjusted — chroma and hue are preserved. A saturated
color has a narrow in-gamut lightness band, so the target is often out of
reach; then the closest color is still printed and the command exits 1.
Check the exit code (or "success" in --json) before using the result.

Examples:
  $ klar find "#ffffff" "#3b82f6" --target 4.5 --type okca
  $ klar find "#000" "#ccc" --target 4.5 --type wcag2
  $ klar find "#ffffff" "#3b82f6" --target 5.5 --json

  # Unreachable: this blue tops out at 5.9 on white, so this exits 1
  $ klar find "#ffffff" "#3b82f6" --target 7`)
    .action(async (baseColor: string, referenceColor: string, opts: {
      target: number;
      type: string;
      tolerance: number;
      json: boolean;
      quiet: boolean;
    }) => {
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

      const { colorUtilService } = getServices();
      if (!colorUtilService.parseColor(baseColor)) errorOut(`Invalid color: ${baseColor}`);
      if (!colorUtilService.parseColor(referenceColor)) errorOut(`Invalid color: ${referenceColor}`);

      const result = colorUtilService.findColorForTargetContrast({
        baseColor,
        referenceColor,
        targetContrast: opts.target,
        contrastType,
        tolerance: opts.tolerance,
      });

      if (opts.quiet) output({ quietValue: result.adjustedColor }, outputOpts);
      else if (opts.json) output(result, outputOpts);
      else output(formatFind({ ...result, baseColor, targetContrast: opts.target, contrastType }), outputOpts);

      // Soft failure (target unachievable): payload is printed above as the
      // closest reachable color; exit 1 so callers can guard with `&&`.
      if (!result.success) markFailure();
    });

  return cmd;
}
