import { Command } from 'commander';
import { getServices } from '../services';
import { output, errorOut, OutputOptions } from '../utils/output';
import { colorSwatch } from '../formatters/human';

export function variantsCommand(): Command {
  const cmd = new Command('variants')
    .description('Generate a grid of color variants (adaptive deltaE spacing by default)')
    .argument('<color>', 'Base color (hex, rgb, oklch)')
    .option('--min-delta <n>', 'Minimum Delta E 2000 between adjacent cells (default: 11)', parseFloat)
    .option('--light-steps <n>', 'Fixed lightness steps (disables adaptive mode)', parseInt)
    .option('--chroma-steps <n>', 'Fixed chroma steps (disables adaptive mode)', parseInt)
    .option('--color-space <space>', 'oklch or hsl (hsl forces fixed-step mode)', 'oklch')
    .option('--json', 'Output as JSON', false)
    .addHelpText('after', `
Default mode (adaptive): grid self-sizes so every neighbor differs
by >= 11 Delta E 2000. No wasted out-of-gamut cells.

  $ klar variants "#3b82f6"
  $ klar variants "#ff6600" --min-delta 15
  $ klar variants "#3b82f6" --json

Fixed-step mode (explicit --light-steps / --chroma-steps):

  $ klar variants "#3b82f6" --light-steps 10 --chroma-steps 5
  $ klar variants "#3b82f6" --color-space hsl --light-steps 5 --chroma-steps 3`)
    .action(async (color: string, opts: {
      minDelta?: number;
      lightSteps?: number;
      chromaSteps?: number;
      colorSpace: string;
      json: boolean;
    }) => {
      if (!['oklch', 'hsl'].includes(opts.colorSpace)) {
        errorOut(`Invalid color space "${opts.colorSpace}". Must be oklch or hsl`);
      }
      const space = opts.colorSpace as 'oklch' | 'hsl';
      const outputOpts: OutputOptions = { json: opts.json, quiet: false };
      const useFixedSteps = opts.lightSteps !== undefined
        || opts.chromaSteps !== undefined
        || space === 'hsl';

      const { colorUtilService } = getServices();
      if (!colorUtilService.parseColor(color)) errorOut(`Invalid color: ${color}`);

      if (useFixedSteps) {
        const lightSteps = opts.lightSteps ?? 10;
        const chromaSteps = opts.chromaSteps ?? 5;
        const variants = colorUtilService.generateAllOklchVariants(color, lightSteps, chromaSteps, space);

        if (opts.json) {
          output(variants, outputOpts);
        } else {
          renderHuman(variants, color, space, outputOpts);
        }
      } else {
        // Adaptive deltaE mode (default)
        const minDelta = opts.minDelta ?? 11;
        const variants = colorUtilService.generateAdaptiveVariants(color, minDelta);

        if (opts.json) {
          output(variants, outputOpts);
        } else {
          renderHuman(variants, color, 'oklch', outputOpts, minDelta);
        }
      }
    });

  return cmd;
}

function renderHuman(
  grid: Array<Array<{ color: string }>>,
  baseColor: string,
  space: string,
  outputOpts: OutputOptions,
  minDelta?: number,
): void {
  const label = minDelta
    ? `Variants for ${colorSwatch(baseColor)} ${baseColor} (adaptive, minDelta=${minDelta})`
    : `Variants for ${colorSwatch(baseColor)} ${baseColor} (${space.toUpperCase()})`;
  const lines: string[] = [label];
  for (const row of grid) {
    const cells = row
      .map((cell) => (cell.color ? colorSwatch(cell.color) : '  '))
      .join(' ');
    lines.push(`  ${cells}`);
  }
  const maxCols = Math.max(...grid.map(r => r.length), 0);
  lines.push(`  ${grid.length} rows x ${maxCols} cols`);
  output(lines.join('\n'), outputOpts);
}
