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
 * Raised when a request falls outside the domain where an algorithm's result is
 * established, rather than returning a number anyway — silently answering
 * outside a proven domain is the bug this module exists to prevent.
 *
 * This is a *validity domain* limit, not a representation one. An earlier
 * version framed it as "hex cannot express an out-of-gamut color", which is
 * false: `OkcaService.contrast()` accepts `oklch()` strings and will happily
 * take coordinates from anywhere. The reason to refuse is that OKCA's guarantee
 * is established across the sRGB gamut, so outside it the number is unvalidated
 * extrapolation — and that limit does not go away when the gamut widens.
 *
 * Carries the facts; the CLI layer composes the user-facing message, so no flag
 * name is baked into a service.
 */
export class AlgorithmDomainError extends Error {
  constructor(
    public readonly mode: GamutMode,
    public readonly algorithm: string = 'okca',
  ) {
    super(
      `${algorithm} is established across the sRGB gamut; an unmapped ` +
        `out-of-gamut color is outside that domain.`,
    );
    this.name = 'AlgorithmDomainError';
  }
}

export function isInSrgbGamut(color: Color): boolean {
  return color.inGamut('srgb');
}

/**
 * Read a color's coordinates as primitive numbers.
 *
 * colorjs.io returns **boxed `Number` objects** for bare-number CSS
 * coordinates — `oklch(0.45 0.22 25)` yields objects, while `oklch(45% ...)`
 * and `#3b82f6` yield primitives. They behave like numbers almost everywhere:
 * arithmetic, comparison, `toFixed`, and `JSON.stringify` all work through
 * coercion, which is why this has gone unnoticed.
 *
 * Where it does not work is any check that refuses to coerce:
 *
 *   Number.isFinite(boxed)  →  false        // not NaN — just not a primitive
 *   boxed === 0.22          →  false
 *   typeof boxed            →  'object'
 *
 * A guard written the obvious way therefore misfires on exactly the inputs klar
 * is built around. Normalize once, here, rather than discovering it per site.
 */
export function numericCoords(color: Color, space: string): [number, number, number] {
  return color.to(space).coords.map(Number) as [number, number, number];
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
 * Resolve a color to hex under a gamut policy, for **plugin** algorithms.
 *
 * Plugins receive hex and only hex. The interface gives them no way to declare
 * what they accept (see klar#11), so klar cannot know that a given plugin would
 * parse anything else — handing them `oklch()` because okca happens to accept it
 * would break any plugin that only reads hex, silently. Built-ins whose input
 * contract *is* known use `toGamutOklch` instead.
 */
export function toGamutHex(color: Color, mode: GamutMode): string {
  if (mode === 'none') throw new AlgorithmDomainError(mode, 'this algorithm');
  return applyGamut(color, mode).to('srgb').toString({ format: 'hex' });
}

/**
 * Resolve a color to an `oklch()` string under a gamut policy, at full precision.
 *
 * OKCA accepts `oklch()` directly, so routing it here instead of through hex
 * removes an 8-bit quantization step that made it disagree slightly with the
 * continuous algorithms (`wcag2`, `deltaE`) about which color was being
 * measured. It also drops an sRGB-shaped bottleneck: hex cannot carry
 * wide-gamut coordinates and `oklch()` can.
 *
 * Two coordinate hazards are normalized here, both of which make okca return
 * `null` rather than fail loudly:
 *
 *  - **Achromatic colors get a `NaN` hue.** `#767676` converts to
 *    `oklch(0.5658 6.2e-16 NaN)`. Every neutral in a design system hits this,
 *    so it would not be a rare edge — it would be most of a token set.
 *  - **Residual chroma arrives in exponent notation.** That same conversion
 *    yields `6.206335383118183e-16`, which is not valid CSS number syntax.
 *
 * Both are artifacts of floating-point conversion rather than real color
 * information, so both are flattened.
 */
export function toGamutOklch(color: Color, mode: GamutMode, algorithm = 'okca'): string {
  if (mode === 'none') throw new AlgorithmDomainError(mode, algorithm);

  // `numericCoords`, not `.coords` — the guards below use `Number.isFinite`,
  // which returns false for a boxed coordinate and would zero out a valid chroma.
  const [l, c, h] = numericCoords(applyGamut(color, mode), 'oklch');

  // Below this, chroma is conversion noise, not color — and it is exactly the
  // range that serializes to exponent notation.
  const chroma = !Number.isFinite(c) || Math.abs(c) < 1e-6 ? 0 : c;
  // Hue is undefined for an achromatic color; any finite value is equivalent.
  const hue = Number.isFinite(h) ? h : 0;

  return `oklch(${l} ${chroma} ${hue})`;
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
