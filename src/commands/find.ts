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
    .option('--allow-desaturation', 'Permit reducing chroma to reach the target', false)
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print only the adjusted color hex', false)
    .addHelpText('after', `
By default only lightness moves. An out-of-gamut reference is first
chroma-reduced onto the gamut boundary — that is mandatory, since otherwise
there is no renderable color to return — but chroma is never traded for
contrast unless you ask.

When lightness runs out, the command exits 1 and reports what would solve it
under "resolvableBy", without applying it: trading brand saturation for
contrast is a design decision, not a computation. Pass --allow-desaturation
where that decision has already been made.

Branch on "reason", never on "message":
  ok                    target met
  lightness-exhausted   a solution exists but costs saturation — see resolvableBy
  chroma-exhausted      chroma reached 0 and the target is still unmet
  unreachable           no color meets this against this base; change the base

Examples:
  $ klar find "#ffffff" "#3b82f6" --target 4.5 --type okca
  $ klar find "#000" "#ccc" --target 4.5 --type wcag2
  $ klar find "#ffffff" "#3b82f6" --target 5.5 --json
  $ klar find "#070e16" "oklch(0.79 0.22 25)" --target 8 --allow-desaturation

  # Unreachable: this blue tops out at 5.9 on white, so this exits 1
  $ klar find "#ffffff" "#3b82f6" --target 7`)
    .action(async (baseColor: string, referenceColor: string, opts: {
      target: number;
      type: string;
      tolerance: number;
      allowDesaturation: boolean;
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
        allowDesaturation: opts.allowDesaturation,
      });

      if (opts.quiet) output({ quietValue: result.adjustedColor }, outputOpts);
      else if (opts.json) output(result, outputOpts);
      else output(formatFind({ ...result, baseColor, targetContrast: opts.target, contrastType }), outputOpts);

      // Normalization is not a failure — resolving an out-of-gamut reference is
      // this command's job — but a `-q` caller would otherwise receive a color
      // it did not ask about with no indication why. stderr keeps stdout clean.
      if (result.gamut.outOfGamut) {
        process.stderr.write(
          `klar: reference ${referenceColor} is outside sRGB; ` +
            `normalized to ${result.gamut.measured}\n`,
        );
      }

      // Soft failure (target unachievable): payload is printed above as the
      // closest reachable color; exit 1 so callers can guard with `&&`.
      if (!result.success) markFailure();
    });

  return cmd;
}
