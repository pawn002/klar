/** IDs of the contrast algorithms built into klar (no plugin required). */
export const BUILTIN_CONTRAST_TYPES = ['okca', 'deltaE', 'wcag2'] as const;
export type BuiltinContrastType = (typeof BUILTIN_CONTRAST_TYPES)[number];

/**
 * A string that identifies a contrast algorithm — either a built-in type or
 * the `id` self-declared by an installed contrast-algorithm plugin.
 */
export type ContrastType = string;

export type ColorPair = [string, string];
export type ColorCoordArray = [number, number, number];

export class ChromaMatchObject {
  success: boolean = false;
  colors: ColorPair | null = null;
  chroma: number = NaN;
}

export interface MinMaxLightObject {
  originalCoords: ColorCoordArray;
  lightMin: number;
  lightMax: number;
}

export interface ColorMetaObj {
  lightness: number | string;
  chroma: number | string;
  hue: number | string;
  saturation: number | string;
}

export interface TableColorCell {
  color: string;
  lightness: number;
  chroma: number;
  hue: number;
  deltaE: number;
  deltaChroma: number;
  deltaLightness: number;
}

export type TableData = Array<Array<TableColorCell>>;

export interface TargetContrastOptions {
  baseColor: string;
  referenceColor: string;
  targetContrast: number;
  contrastType: ContrastType;
  tolerance?: number;
}

export interface TargetContrastResult {
  adjustedColor: string;
  actualContrast: number;
  iterations: number;
  success: boolean;
  message?: string;
  oklch?: {
    l: number;
    c: number;
    h: number;
  };
}
