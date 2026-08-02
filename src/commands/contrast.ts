import { Command } from 'commander';
import { getServices } from '../services';
import { ContrastType } from '../services/types';
import {
  GAMUT_MODES,
  GAMUT_MODE_HELP,
  GamutMode,
  DEFAULT_GAMUT_MODE,
  AlgorithmDomainError,
  describeGamut,
} from '../services/gamut';
import { output, errorOut, OutputOptions } from '../utils/output';
import { formatContrast } from '../formatters/human';
import { PLUGIN_DOCS_URL } from '../constants';

export function contrastCommand(): Command {
  const cmd = new Command('contrast')
    .description('Calculate contrast between a foreground and a background, as an sRGB display paints it. OKCA is polarity-aware — argument order matters (some plugins are too).')
    .argument('<foreground>', 'Foreground color (hex, rgb, oklch)')
    .argument('<background>', 'Background color (hex, rgb, oklch)')
    .option('-t, --type <type>', 'Algorithm: okca, wcag2, deltaE (built-in), plus any installed contrast-algorithm plugins', 'okca')
    .option('-g, --gamut <mode>', GAMUT_MODE_HELP, DEFAULT_GAMUT_MODE)
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print only the numeric value', false)
    .addHelpText('after', `
Out-of-gamut colors:
  A color authored in OKLCH may sit outside sRGB. klar measures what an sRGB
  display actually paints, because a contrast figure for a color that cannot
  be displayed is not an accessibility measurement. --json reports
  gamut.outOfGamut and the measured value so consumers can detect the case.
  On a wider-gamut display the color clips less and real contrast is higher;
  sRGB is the conservative floor.

Examples:
  $ klar contrast "#fff" "#000"
  $ klar contrast "#fff" "#000" --type wcag2
  $ klar contrast "oklch(50% 0.2 240)" "#000" -q
  $ klar contrast "oklch(0.79 0.22 25)" "#070e16" --json
  $ klar contrast "oklch(0.79 0.22 25)" "#070e16" --gamut css
  $ klar contrast "#fff" "#000" --type okca --json`)
    .action(async (color1: string, color2: string, opts: { type: string; gamut: string; json: boolean; quiet: boolean }) => {
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
      if (!(GAMUT_MODES as readonly string[]).includes(opts.gamut)) {
        errorOut(
          `Unknown gamut mode "${opts.gamut}".\nAvailable modes: ${GAMUT_MODES.join(', ')}`,
        );
      }
      const gamut = opts.gamut as GamutMode;
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
        // `--gamut none` against an algorithm that takes hex. Refusing beats
        // silently measuring a different color — the failure this command was
        // fixed for.
        if (err instanceof AlgorithmDomainError) errorOut(err.message);
        throw err;
      }
      if (contrast === null) errorOut('Unable to calculate contrast for the given colors');

      const gamutOne = describeGamut(parsedOne!, gamut);
      const gamutTwo = describeGamut(parsedTwo!, gamut);

      const plugin = pluginRegistry.get(contrastType);
      const data = {
        contrast: contrast!,
        type: contrastType,
        colorOne: color1,
        colorTwo: color2,
        unit: plugin?.unit,
        category: plugin?.category,
        gamut: {
          mode: gamut,
          outOfGamut: gamutOne.outOfGamut || gamutTwo.outOfGamut,
          colorOne: gamutOne,
          colorTwo: gamutTwo,
        },
      };
      if (opts.quiet) output({ quietValue: contrast }, outputOpts);
      else if (opts.json) output(data, outputOpts);
      else output(formatContrast(data), outputOpts);
    });

  return cmd;
}
