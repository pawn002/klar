import { GamutMode } from './gamut';

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
  /**
   * Bounds of the in-gamut lightness range at this color's chroma and hue,
   * or `null` when the chroma puts the color outside the gamut at *every*
   * lightness — i.e. there is no usable range at all.
   */
  lightMin: number | null;
  lightMax: number | null;
  /** True when the input color itself lies outside the sRGB gamut. */
  outOfGamut: boolean;
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

/**
 * Why `find` stopped, as a machine-readable value.
 *
 * These describe the *caller's* constraint, not klar's limitation:
 *  - `lightness-exhausted` — desaturation was not permitted, and lightness alone
 *    could not reach the target. A solution may still exist; see `resolvableBy`.
 *  - `chroma-exhausted` — desaturation was permitted and chroma reached 0 at the
 *    reference's lightness without reaching the target.
 *  - `unreachable` — the target exceeds what *any* color can reach against this
 *    base. Changing the reference color cannot help; the base has to change.
 *
 * `message` remains human prose and is not stable. Branch on this.
 */
export type FindReason = 'ok' | 'lightness-exhausted' | 'chroma-exhausted' | 'unreachable';

/** An axis moved in service of the target. Gamut normalization is not an axis. */
export type FindAxis = 'lightness' | 'chroma';

export interface TargetContrastOptions {
  baseColor: string;
  referenceColor: string;
  targetContrast: number;
  contrastType: ContrastType;
  tolerance?: number;
  /**
   * Permit reducing chroma to reach the target. Off by default: trading brand
   * saturation for contrast is a design decision, and an agent accepting a
   * desaturated brand color silently produces drift no single call reveals.
   */
  allowDesaturation?: boolean;
}

export interface TargetContrastResult {
  adjustedColor: string;
  actualContrast: number;
  iterations: number;
  success: boolean;
  reason: FindReason;
  /** Which axes moved to reach the target. Empty when nothing needed to move. */
  axesAdjusted: FindAxis[];
  /** Perceptual drift from the reference color, Delta E 2000. */
  deltaE: number | null;
  /**
   * Present on `lightness-exhausted`: the chroma that *would* reach the target
   * at the reference color's original lightness, and what it costs — reported
   * without being applied, so a human can decide.
   */
  resolvableBy?: { chroma: number; deltaE: number | null };
  message?: string;
  oklch?: {
    l: number;
    c: number;
    h: number;
  };
  /** Whether the reference color needed normalizing into the gamut, and to what. */
  gamut: { outOfGamut: boolean; measured?: string };
}
