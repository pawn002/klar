/**
 * Human-readable formatters with ANSI true-color swatches.
 *
 * We use raw ANSI escape codes instead of chalk to avoid ESM-only import
 * issues in a CommonJS build. chalk v5+ is ESM-only and cannot be required
 * from CommonJS without dynamic import gymnastics.
 */
import Color from 'colorjs.io';
import { GamutMode, DEFAULT_GAMUT_MODE, toRgb255 as gamutToRgb255 } from '../services/gamut';

/**
 * Render an ANSI true-color block: ██
 *
 * The swatch must show the same color the reported number was computed on, so
 * it takes the caller's gamut policy. It previously clamped per channel purely
 * to keep the escape sequence valid, which happened to match what browsers
 * paint while `contrast` scored a chroma-reduced color — one line of output
 * showing one color and reporting a number for another.
 */
export function colorSwatch(color: string, gamut: GamutMode = DEFAULT_GAMUT_MODE): string {
  const rgb = toRgb255(color, gamut);
  if (!rgb) return '██';
  // \x1b[48;2;R;G;Bm sets background, \x1b[38;2;R;G;Bm sets foreground
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m██\x1b[0m`;
}

/**
 * Resolve a color to 8-bit RGB for the swatch.
 *
 * Delegates to colorjs.io — the same parser the rest of klar validates with —
 * so the swatch colors exactly the inputs klar accepts, and nothing else.
 * The previous implementation matched 6 hex digits by hand, which silently
 * emitted an uncolored block for `#fff`, `rgb(...)`, `oklch(...)` and named
 * colors (most of the documented examples), while accepting bare `ff0000`
 * that klar itself rejects.
 */
function toRgb255(color: string, gamut: GamutMode): [number, number, number] | null {
  try {
    return gamutToRgb255(new Color(color), gamut);
  } catch {
    return null;
  }
}

export function formatContrast(data: {
  contrast: number;
  type: string;
  colorOne: string;
  colorTwo: string;
  unit?: string;
  category?: string;
  gamut?: {
    map: GamutMode;
    outOfGamut: boolean;
    measured?: { colorOne?: string; colorTwo?: string };
  };
}): string {
  const label = data.category === 'dimension' ? 'Min Dimension' : 'Contrast';
  const value = data.unit ? `${data.contrast} ${data.unit}` : `${data.contrast}`;
  const mode = data.gamut?.map ?? DEFAULT_GAMUT_MODE;
  const lines = [
    `${label} (${data.type.toUpperCase()}): ${value}`,
    `  ${colorSwatch(data.colorOne, mode)} ${data.colorOne} → ${colorSwatch(data.colorTwo, mode)} ${data.colorTwo}`,
  ];

  // An out-of-gamut input is the one case where the number does not describe
  // the color the user typed. Say so on the spot: silence here reads as "this
  // color is fine", and the error always runs in the permissive direction.
  if (data.gamut?.outOfGamut) {
    const outside = [
      data.gamut.measured?.colorOne ? `foreground → ${data.gamut.measured.colorOne}` : null,
      data.gamut.measured?.colorTwo ? `background → ${data.gamut.measured.colorTwo}` : null,
    ].filter(Boolean);
    lines.push(`  ! outside sRGB; measured as ${outside.join(', ')}`);
    lines.push(`    Reduce chroma until the color is in gamut — the number will not`);
    lines.push(`    move before then, since every chroma above the boundary maps here.`);
  }

  return lines.join('\n');
}

export function formatMeta(data: {
  color: string;
  lightness: number | string;
  chroma: number | string;
  hue: number | string;
  saturation: number | string;
}): string {
  const lines = [
    `Color: ${colorSwatch(data.color)} ${data.color}`,
    `  Lightness:  ${data.lightness}`,
    `  Chroma:     ${data.chroma}`,
    `  Hue:        ${data.hue}°`,
    `  Saturation: ${data.saturation}%`,
  ];
  return lines.join('\n');
}

export function formatPair(data: {
  colorOne: string;
  colorTwo: string;
  contrast: number;
}): string {
  const lines = [
    `Color Pair (OKCA: ${data.contrast})`,
    `  ${colorSwatch(data.colorOne)} Foreground: ${data.colorOne}`,
    `  ${colorSwatch(data.colorTwo)} Background: ${data.colorTwo}`,
  ];
  return lines.join('\n');
}

export function formatMatchChromas(data: {
  success: boolean;
  colors: [string, string] | null;
  chroma: number;
}): string {
  if (!data.success || !data.colors) {
    return 'Chroma matching failed.';
  }
  const lines = [
    `Chroma Matched (${data.chroma.toFixed(3)})`,
    `  ${colorSwatch(data.colors[0])} ${data.colors[0]}`,
    `  ${colorSwatch(data.colors[1])} ${data.colors[1]}`,
  ];
  return lines.join('\n');
}

export function formatLightness(data: {
  originalCoords: [number, number, number];
  lightMin: number | null;
  lightMax: number | null;
  outOfGamut: boolean;
  color: string;
}): string {
  const lines = [`Lightness Range for ${colorSwatch(data.color)} ${data.color}`];

  if (data.lightMin === null || data.lightMax === null) {
    lines.push(`  No lightness renders at this chroma and hue.`);
    lines.push(`  OKLCH: [${data.originalCoords.map((c) => c.toFixed(4)).join(', ')}]`);
    lines.push(`  Reduce chroma below ${data.originalCoords[1].toFixed(4)} to get a usable range.`);
    return lines.join('\n');
  }

  lines.push(`  Min: ${data.lightMin.toFixed(4)}`);
  lines.push(`  Max: ${data.lightMax.toFixed(4)}`);
  lines.push(`  OKLCH: [${data.originalCoords.map((c) => c.toFixed(4)).join(', ')}]`);

  // The input's own lightness can sit outside the range this command reports —
  // that is the signal that the color as authored is not renderable, and it is
  // easy to miss when the numbers are read without comparing them.
  if (data.outOfGamut) {
    lines.push(`  ! outside sRGB as authored; the range above is what this chroma allows.`);
  }

  return lines.join('\n');
}

export function formatFind(data: {
  adjustedColor: string;
  actualContrast: number;
  iterations: number;
  success: boolean;
  reason?: string;
  axesAdjusted?: string[];
  deltaE?: number | null;
  resolvableBy?: { chroma: number; lightness: number; deltaE: number | null };
  message?: string;
  oklch?: { l: number; c: number; h: number };
  gamut?: { outOfGamut: boolean; measured?: string };
  baseColor: string;
  targetContrast: number;
  contrastType: string;
}): string {
  const mark = data.success ? '✓' : '✗';
  const lines = [
    `Target Contrast ${data.success ? 'Found' : 'Failed'} (${data.contrastType.toUpperCase()})`,
    `  Target: ${data.targetContrast}  Actual: ${data.actualContrast}  ${mark}`,
    `  ${colorSwatch(data.baseColor)} Base:     ${data.baseColor}`,
    `  ${colorSwatch(data.adjustedColor)} Adjusted: ${data.adjustedColor}`,
  ];
  if (data.oklch) {
    lines.push(`  OKLCH: [${data.oklch.l.toFixed(4)}, ${data.oklch.c.toFixed(4)}, ${data.oklch.h.toFixed(1)}]`);
  }
  if (data.axesAdjusted?.length) {
    lines.push(`  Moved: ${data.axesAdjusted.join(', ')}`);
  }
  if (typeof data.deltaE === 'number') {
    lines.push(`  Drift: ${data.deltaE} ΔE from the reference`);
  }

  // Normalization is not a failure, but the returned color is not the one that
  // was asked about, and that should not have to be inferred.
  if (data.gamut?.outOfGamut) {
    lines.push(`  ! reference was outside sRGB; normalized to ${data.gamut.measured}`);
  }

  lines.push(`  Iterations: ${data.iterations}`);
  if (data.message) lines.push(`  ${data.message}`);

  // The escalation. A compliant color exists but costs saturation — a brand
  // decision, so it is quoted with its price rather than quietly applied.
  if (data.resolvableBy) {
    lines.push(
      `  → chroma ${data.resolvableBy.chroma.toFixed(3)} at lightness ` +
        `${data.resolvableBy.lightness.toFixed(3)} would reach the target` +
        (typeof data.resolvableBy.deltaE === 'number'
          ? ` (${data.resolvableBy.deltaE} ΔE from the reference)`
          : ''),
    );
    lines.push(`    Apply with --allow-desaturation, or take it to a human.`);
  }

  return lines.join('\n');
}
