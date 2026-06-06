/**
 * Human-readable formatters with ANSI true-color swatches.
 *
 * We use raw ANSI escape codes instead of chalk to avoid ESM-only import
 * issues in a CommonJS build. chalk v5+ is ESM-only and cannot be required
 * from CommonJS without dynamic import gymnastics.
 */

/** Render an ANSI true-color background block: ██ */
export function colorSwatch(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '██';
  // \x1b[48;2;R;G;Bm sets background, \x1b[38;2;R;G;Bm sets foreground
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m██\x1b[0m`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function formatContrast(data: {
  contrast: number;
  type: string;
  colorOne: string;
  colorTwo: string;
  unit?: string;
  category?: string;
}): string {
  const label = data.category === 'dimension' ? 'Min Dimension' : 'Contrast';
  const value = data.unit ? `${data.contrast} ${data.unit}` : `${data.contrast}`;
  const lines = [
    `${label} (${data.type.toUpperCase()}): ${value}`,
    `  ${colorSwatch(data.colorOne)} ${data.colorOne} → ${colorSwatch(data.colorTwo)} ${data.colorTwo}`,
  ];
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
  lightMin: number;
  lightMax: number;
  color: string;
}): string {
  const lines = [
    `Lightness Range for ${colorSwatch(data.color)} ${data.color}`,
    `  Min: ${data.lightMin.toFixed(4)}`,
    `  Max: ${data.lightMax.toFixed(4)}`,
    `  OKLCH: [${data.originalCoords.map((c) => c.toFixed(4)).join(', ')}]`,
  ];
  return lines.join('\n');
}

export function formatFind(data: {
  adjustedColor: string;
  actualContrast: number;
  iterations: number;
  success: boolean;
  message?: string;
  oklch?: { l: number; c: number; h: number };
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
  lines.push(`  Iterations: ${data.iterations}`);
  if (data.message) lines.push(`  ${data.message}`);
  return lines.join('\n');
}
