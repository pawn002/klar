/**
 * Gamut policy — the single place klar decides what an out-of-gamut color
 * "is" for measurement purposes.
 *
 * Why this file exists
 * --------------------
 * A color authored in OKLCH can sit outside the sRGB gamut. It still has to
 * become *something* before a display shows it or a contrast algorithm scores
 * it, and the choice of "something" changes the number. klar used to make that
 * choice in two unrelated places that disagreed with each other:
 *
 *   - `ColorUtilService.toHex` serialized via colorjs.io, which applies CSS
 *     Color 4 gamut mapping (chroma reduction). `oklch(0.79 0.22 25)` became
 *     `#ff938b`, and that is the color `contrast` scored.
 *   - The ANSI swatch clamped sRGB coordinates per channel — incidentally, to
 *     keep the escape sequence valid rather than as a considered policy. The
 *     same color became `#ff746f`, and that is the color the user saw.
 *
 * So a single line of `klar contrast` output rendered one color and reported a
 * number computed on a different one, and neither the caller nor the docs said
 * which was which. Worse, the value being measured (`#ff938b`) was nobody's
 * intent: not the authored color, and not what a browser paints.
 *
 * Every conversion now routes through this module, and the policy is an
 * explicit, user-visible parameter rather than an accident of which helper a
 * code path happened to call.
 *
 * On `clip` being the default
 * ---------------------------
 * Browsers today clip per channel: Chrome paints `oklch(0.45 0.22 25)` as
 * R176/G0/B0, not the CSS Color 4 chroma-reduced `#a9000b`. Since klar is an
 * accessibility tool, the number should describe what a user's screen receives,
 * so `clip` is the default.
 *
 * This is a statement about current browser behavior, not about the spec.
 * CSS Color 4 specifies chroma reduction and engines are expected to move
 * toward it; when they do, `css` becomes the accurate answer and this default
 * should be revisited. That is why the modes are named for the question they
 * answer rather than for their vintage.
 *
 * Note also that "as painted" is only one number for one output space. On a
 * P3 display the color clips less and real contrast is better. sRGB is the
 * conservative case, and the right one to hold an accessibility floor against.
 *
 * One residual gap, deliberately left
 * -----------------------------------
 * `clip` is a gamut operation only: it clamps channels into range but keeps
 * float precision. Algorithms that take hex (OKCA and every plugin) additionally
 * quantize to 8 bits, so they can differ from the continuous-space algorithms by
 * a rounding step. Quantizing here would close that, but it would also change
 * results for colors that were never out of gamut, which is a wider change than
 * this policy needs to make. The residual is ~0.1; the defect it replaces was 2.1.
 */
import Color from 'colorjs.io';

export const GAMUT_MODES = ['clip', 'css', 'none'] as const;
export type GamutMode = (typeof GAMUT_MODES)[number];

/** What a display actually paints today. See the note above before changing. */
export const DEFAULT_GAMUT_MODE: GamutMode = 'clip';

export const GAMUT_MODE_HELP =
  'Out-of-gamut handling: clip (as browsers paint today), css (CSS Color 4 chroma reduction), none (measure the authored color; unavailable for algorithms that take hex)';

/**
 * Raised when a mode cannot be honored for a given algorithm rather than
 * silently substituting a different one — silent substitution is the bug this
 * module exists to prevent.
 */
export class GamutNotRepresentableError extends Error {
  constructor(public readonly mode: GamutMode) {
    super(
      `--gamut ${mode} cannot be used with an algorithm that operates on hex. ` +
        `Hex cannot represent a color outside the sRGB gamut, so the color would ` +
        `have to be mapped anyway. Use --gamut clip or --gamut css, or choose an ` +
        `algorithm that works in a continuous space (wcag2, deltaE).`,
    );
    this.name = 'GamutNotRepresentableError';
  }
}

export function isInSrgbGamut(color: Color): boolean {
  return color.inGamut('srgb');
}

/**
 * Per-channel clamp of gamma-encoded sRGB coordinates — what browsers paint.
 *
 * Deliberate policy, not incidental range-guarding: do not "tidy" this into
 * colorjs.io's `toGamut`, which implements chroma reduction and yields
 * different colors (it agrees with Chrome on well under half of out-of-gamut
 * samples). See `gamut.spec.ts`, which pins the specific values.
 */
export function clipToSrgb(color: Color): Color {
  const coords = color.to('srgb').coords.map((c) => Math.min(1, Math.max(0, c)));
  return new Color('srgb', coords as [number, number, number]);
}

/**
 * CSS Color 4 gamut mapping: reduce chroma in OKLCH until the color fits.
 *
 * Must stay on colorjs.io's `css` method, not `oklch.c`. The `css` method is
 * the spec algorithm (chroma reduction with local clipping against deltaE),
 * and it is what klar 2.x produced implicitly via hex serialization —
 * `#ff938b` for `oklch(0.79 0.22 25)`, where plain `oklch.c` gives `#ff928a`.
 * This mode exists so 2.x figures can be reproduced exactly, so a near-miss
 * would defeat its only purpose.
 */
export function cssMapToSrgb(color: Color): Color {
  return color.to('srgb').toGamut({ space: 'srgb', method: 'css' });
}

/**
 * Resolve a color under a gamut policy, for algorithms that can work in a
 * continuous space. `none` returns the authored color untouched, which may
 * carry out-of-range sRGB coordinates.
 */
export function applyGamut(color: Color, mode: GamutMode): Color {
  switch (mode) {
    case 'clip':
      return clipToSrgb(color);
    case 'css':
      return cssMapToSrgb(color);
    case 'none':
      return color;
  }
}

/**
 * Resolve a color to hex under a gamut policy, for algorithms that take hex
 * (OKCA and every plugin). Throws on `none` rather than quietly mapping.
 */
export function toGamutHex(color: Color, mode: GamutMode): string {
  if (mode === 'none') throw new GamutNotRepresentableError(mode);
  return applyGamut(color, mode).to('srgb').toString({ format: 'hex' });
}

/** 8-bit RGB under a gamut policy — for ANSI swatches. */
export function toRgb255(color: Color, mode: GamutMode = DEFAULT_GAMUT_MODE): [number, number, number] {
  // `none` has no 8-bit representation; a swatch must show something a
  // terminal can paint, so fall back to the painted color.
  const resolved = applyGamut(color, mode === 'none' ? 'clip' : mode);
  return resolved.to('srgb').coords.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255)) as [
    number,
    number,
    number,
  ];
}

export interface GamutReport {
  /** True when the authored color lies outside the sRGB gamut. */
  outOfGamut: boolean;
  /** The color the contrast figure was actually computed on. */
  measured: string;
}

/** Describe how a single color was treated, for `--json` consumers. */
export function describeGamut(color: Color, mode: GamutMode): GamutReport {
  const outOfGamut = !isInSrgbGamut(color);
  const resolved = applyGamut(color, mode);
  return {
    outOfGamut,
    measured:
      mode === 'none' && outOfGamut
        ? resolved.to('oklch').toString()
        : resolved.to('srgb').toString({ format: 'hex' }),
  };
}
