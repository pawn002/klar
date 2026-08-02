import { Command } from 'commander';
import { getServices } from '../services';
import { ContrastType } from '../services/types';
import {
  GAMUT_MODES,
  GAMUT_MODE_HELP,
  GAMUT_MODE_ENV_VAR,
  GamutMode,
  defaultGamutMode,
  AlgorithmDomainError,
  describeGamut,
} from '../services/gamut';
import { output, errorOut, markFailure, OutputOptions } from '../utils/output';
import { formatContrast } from '../formatters/human';
import { PLUGIN_DOCS_URL } from '../constants';

export function contrastCommand(): Command {
  const cmd = new Command('contrast')
    .description('Calculate contrast between a foreground and a background. OKCA is polarity-aware — argument order matters (some plugins are too).')
    .argument('<foreground>', 'Foreground color (hex, rgb, oklch)')
    .argument('<background>', 'Background color (hex, rgb, oklch)')
    .option('-t, --type <type>', 'Algorithm: okca, wcag2, deltaE (built-in), plus any installed contrast-algorithm plugins', 'okca')
    .option('--gamut-map <method>', GAMUT_MODE_HELP, defaultGamutMode())
    .option('--allow-out-of-gamut', 'Exit 0 instead of 1 when an input is outside the gamut', false)
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print only the numeric value', false)
    .addHelpText('after', `
Out-of-gamut colors:
  A color authored in OKLCH can sit outside sRGB. It has to be resolved to a
  displayable color before it can be measured, so the reported number describes
  that mapped equivalent — not the color in your token file. That is a real
  answer to a different question, so it exits 1 rather than passing silently.
  Pass --allow-out-of-gamut to accept it, or read gamut.outOfGamut from --json.

  Reducing chroma is the fix, but the number will not move until the color is
  actually in gamut: chroma reduction maps every out-of-gamut chroma at a given
  lightness and hue onto the same boundary color.

  ${GAMUT_MODE_ENV_VAR} sets the default mapping process-wide. No environment
  variable waives the failure — that decision belongs at the call site.

Examples:
  $ klar contrast "#fff" "#000"
  $ klar contrast "#fff" "#000" --type wcag2
  $ klar contrast "oklch(50% 0.2 240)" "#000" -q
  $ klar contrast "oklch(0.79 0.22 25)" "#070e16" --json
  $ klar contrast "oklch(0.79 0.22 25)" "#070e16" --allow-out-of-gamut -q
  $ klar contrast "#fff" "#000" --type okca --json`)
    .action(async (
      color1: string,
      color2: string,
      opts: { type: string; gamutMap: string; allowOutOfGamut: boolean; json: boolean; quiet: boolean },
    ) => {
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

      if (!(GAMUT_MODES as readonly string[]).includes(opts.gamutMap)) {
        errorOut(
          `Unknown gamut mapping "${opts.gamutMap}".\nAvailable: ${GAMUT_MODES.join(', ')}`,
        );
      }
      const gamut = opts.gamutMap as GamutMode;
      const outputOpts: OutputOptions = { json: opts.json, quiet: opts.quiet };

      const { colorMetricsService, colorUtilService } = getServices();
      const parsedOne = colorUtilService.parseColor(color1);
      const parsedTwo = colorUtilService.parseColor(color2);
      if (!parsedOne) errorOut(`Invalid color: ${color1}`);
      if (!parsedTwo) errorOut(`Invalid color: ${color2}`);

      let contrast: number | null;
      try {
        contrast = colorMetricsService.getContrast(color1, color2, contrastType, gamut);
      } catch (err) {
        // Refusing beats measuring something else and not saying so. The service
        // carries the facts; the flag names belong here.
        if (err instanceof AlgorithmDomainError) {
          errorOut(
            `--gamut-map none cannot be used with --type ${contrastType}.\n` +
              `${err.message}\n` +
              `Use --gamut-map css or clip, or --type wcag2 / deltaE, which are ` +
              `defined continuously.`,
          );
        }
        throw err;
      }
      if (contrast === null) errorOut('Unable to calculate contrast for the given colors');

      const one = describeGamut(parsedOne!, gamut);
      const two = describeGamut(parsedTwo!, gamut);
      const outOfGamut = one.outOfGamut || two.outOfGamut;

      // Only the colors that were actually mapped are listed. In gamut — the
      // common case — this is three lines, and `outOfGamut: false` still states
      // the fact explicitly rather than leaving it to be inferred from absence.
      const measured: Record<string, string> = {};
      if (one.outOfGamut) measured.colorOne = one.measured;
      if (two.outOfGamut) measured.colorTwo = two.measured;

      const plugin = pluginRegistry.get(contrastType);
      const data = {
        contrast: contrast!,
        type: contrastType,
        colorOne: color1,
        colorTwo: color2,
        unit: plugin?.unit,
        category: plugin?.category,
        gamut: { map: gamut, outOfGamut, ...(outOfGamut ? { measured } : {}) },
      };

      if (opts.quiet) output({ quietValue: contrast }, outputOpts);
      else if (opts.json) output(data, outputOpts);
      else output(formatContrast(data), outputOpts);

      if (outOfGamut) {
        // stderr, so `-q` stays composable: the exit code says a color was
        // mapped, this says which one and what it became, and stdout stays a
        // bare number for `$( )`.
        const which = [
          one.outOfGamut ? `${color1} → ${one.measured}` : null,
          two.outOfGamut ? `${color2} → ${two.measured}` : null,
        ].filter(Boolean);
        process.stderr.write(`klar: outside sRGB, measured as ${which.join(', ')}\n`);
        if (!opts.allowOutOfGamut) markFailure();
      }
    });

  return cmd;
}
