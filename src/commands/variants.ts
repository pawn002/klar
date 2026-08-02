import { Command } from 'commander';
import { getServices } from '../services';
import { output, errorOut, OutputOptions } from '../utils/output';
import { colorSwatch } from '../formatters/human';

export function variantsCommand(): Command {
  const cmd = new Command('variants')
    .description('Generate a grid of color variants (adaptive deltaE spacing by default)')
    .argument('<color>', 'Base color (hex, rgb, oklch)')
    .option('--min-delta <n>', 'Minimum Delta E 2000 between vertically adjacent cells in a column, adaptive mode only (default: 11)', parseFloat)
    .option('--light-steps <n>', 'Fixed lightness steps (disables adaptive mode)', parseInt)
    .option('--chroma-steps <n>', 'Fixed chroma steps (disables adaptive mode)', parseInt)
    .option('--color-space <space>', 'oklch or hsl (hsl forces fixed-step mode)', 'oklch')
    .option('--json', 'Output as JSON', false)
    .addHelpText('after', `
Default mode (adaptive): each column holds one chroma, and the grid
self-sizes so vertically adjacent cells in a column differ by at least
--min-delta (11 by default). Cells side by side in a row differ in
chroma and are not held to that floor. Every cell emitted is in gamut.

  $ klar variants "#3b82f6"
  $ klar variants "#ff6600" --min-delta 15
  $ klar variants "#3b82f6" --json

Fixed-step mode (explicit --light-steps / --chroma-steps): divides the
space uniformly and is NOT gamut-aware — cells outside sRGB come back as
"color": "", and they are often the majority (--light-steps 10
--chroma-steps 5 on a saturated blue yields 50 cells, 36 of them empty).
Filter them out before use; passing "" to another klar command is an
error. Prefer adaptive mode unless you need fixed dimensions.

  $ klar variants "#3b82f6" --light-steps 10 --chroma-steps 5
  $ klar variants "#3b82f6" --color-space hsl --light-steps 5 --chroma-steps 3
  $ klar variants "#3b82f6" --light-steps 4 --chroma-steps 3 --json | jq -r '.[][] | select(.color != "") | .color'`)
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
      const parsed = colorUtilService.parseColor(color);
      if (!parsed) errorOut(`Invalid color: ${color}`);

      // An out-of-gamut base means the grid is not centered where the caller
      // thinks: adaptive mode walks chroma down until it finds renderable cells,
      // so a base at chroma 0.4 can silently produce a grid starting near 0.035.
      // Reported on stderr rather than in the payload, because the payload is a
      // bare array and this command's own documented `jq '.[][]'` recipes would
      // break if it were wrapped — and every cell in it is in gamut regardless.
      // Not a failure: producing a grid is still the right answer.
      if (!parsed!.inGamut('srgb')) {
        process.stderr.write(
          `klar: ${color} is outside sRGB; the grid is built from the chroma range ` +
            `that renders, not the one requested\n`,
        );
      }

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
