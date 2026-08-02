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
 * intent — it fell out of a serialization call.
 *
 * Every conversion now routes through this module, and the policy is an
 * explicit, user-visible parameter rather than an accident of which helper a
 * code path happened to call.
 *
 * On `css` being the default
 * --------------------------
 * CSS Color 4 gamut mapping — chroma reduction until the color fits — is the
 * standard answer to "what is this color, in this gamut", and it is the same
 * operation everywhere klar maps a color, whether measuring or producing.
 *
 * klar deliberately takes **no position on what any particular browser does**.
 * Engines vary and change; tracking them would mean maintaining a matrix of
 * engines and versions indefinitely, and re-verifying it forever. The spec is a
 * stable reference and an implementation is not, so klar targets the spec and
 * leaves rendering behavior to renderers.
 *
 * `clip` remains available as a well-defined operation — clamp each channel
 * into range — for callers who specifically want it. It is described as what it
 * is, with no claim about who performs it.
 *
 * A consequence worth knowing
 * ---------------------------
 * Chroma reduction maps *every* out-of-gamut chroma at a given lightness and hue
 * onto the same boundary color. `oklch(0.79 0.22 25)` and `oklch(0.79 0.15 25)`
 * both become `#ff938b`. Measured contrast is therefore flat across the whole
 * out-of-gamut range and only starts moving once the color is inside it, so two
 * genuinely different authored tokens can produce an identical number. The
 * out-of-gamut signal is the only thing distinguishing them, which is why it is
 * reported in every mode and cannot be traded away for output size.
 */
import Color from 'colorjs.io';

export const GAMUT_MODES = ['clip', 'css', 'none'] as const;
export type GamutMode = (typeof GAMUT_MODES)[number];

/** The CSS Color 4 standard mapping. See the note above before changing. */
export const DEFAULT_GAMUT_MODE: GamutMode = 'css';

/** Environment override for the default. Config only — it cannot silence a signal. */
export const GAMUT_MODE_ENV_VAR = 'KLAR_GAMUT_MAP';

export const GAMUT_MODE_HELP =
  'Out-of-gamut resolution: css (CSS Color 4 chroma reduction), clip (clamp each channel into range), none (measure the authored color; unavailable for algorithms whose domain it exceeds)';

/**
 * Resolve the default mapping mode, honoring `KLAR_GAMUT_MAP`.
 *
 * Configuration is global because a project should measure against one policy.
 * Waiving a *failure* is not configuration and has no environment variable —
 * see `--allow-out-of-gamut`. An env var that mutes a signal gets set once in
 * CI and never removed, which reinstates the failure mode this module exists to
 * eliminate.
 */
export function defaultGamutMode(env: NodeJS.ProcessEnv = process.env): GamutMode {
  const fromEnv = env[GAMUT_MODE_ENV_VAR];
  return fromEnv && (GAMUT_MODES as readonly string[]).includes(fromEnv)
    ? (fromEnv as GamutMode)
    : DEFAULT_GAMUT_MODE;
}

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
