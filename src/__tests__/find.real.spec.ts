import Color from 'colorjs.io';
import { getServices } from '../services';

/**
 * Real-library specs for `find`. Gamut normalization and the chroma search turn
 * on exact sRGB boundaries, which the colorjs.io mock only approximates.
 */
describe('find (issue #9 knock-on)', () => {
  const { colorUtilService } = getServices();

  const run = (base: string, ref: string, target: number, allowDesaturation = false) =>
    colorUtilService.findColorForTargetContrast({
      baseColor: base,
      referenceColor: ref,
      targetContrast: target,
      contrastType: 'okca',
      allowDesaturation,
    });

  describe('never returns an unrenderable color', () => {
    // The defect: an out-of-gamut reference has no in-gamut candidate at its
    // authored chroma, so every candidate failed the gamut check, the
    // `bestAchievable` fallback stayed null, and `find` handed back the input
    // untouched — a color that cannot be displayed, marked as the closest result.
    const OUT_OF_GAMUT = ['oklch(0.45 0.22 25)', 'oklch(0.79 0.22 25)', 'oklch(0.7 0.3 150)'];

    it.each(OUT_OF_GAMUT)('%s resolves to something displayable', (ref) => {
      const result = run('oklch(1 0 0)', ref, 9.5);
      expect(new Color(result.adjustedColor).inGamut('srgb')).toBe(true);
      expect(result.adjustedColor).not.toBe(ref);
    });

    it.each(OUT_OF_GAMUT)('%s reports the normalization', (ref) => {
      const result = run('oklch(1 0 0)', ref, 9.5);
      expect(result.gamut.outOfGamut).toBe(true);
      expect(result.gamut.measured).toMatch(/^#[0-9a-f]{3,6}$/i);
    });
  });

  describe('gamut normalization is mandatory, and is not an axis', () => {
    it('solves a target the normalized color already clears', () => {
      const result = run('#070e16', 'oklch(0.79 0.22 25)', 5.5);
      expect(result.success).toBe(true);
      expect(result.reason).toBe('ok');
    });

    it('does not report chroma as adjusted when only normalization moved it', () => {
      // Normalization is reported under `gamut`. Listing it as an axis would
      // tell a caller their saturation was traded away when it was structurally
      // unavoidable.
      const result = run('#070e16', 'oklch(0.79 0.22 25)', 5.5);
      expect(result.axesAdjusted).not.toContain('chroma');
    });
  });

  describe('escalation instead of silent substitution', () => {
    const result = run('#070e16', 'oklch(0.79 0.22 25)', 8);

    it('fails rather than desaturating a brand color unasked', () => {
      expect(result.success).toBe(false);
      expect(result.reason).toBe('lightness-exhausted');
      expect(result.axesAdjusted).toEqual([]);
    });

    it('reports what would solve it, with the cost attached', () => {
      expect(result.resolvableBy).toBeDefined();
      expect(result.resolvableBy!.chroma).toBeGreaterThan(0);
      expect(typeof result.resolvableBy!.deltaE).toBe('number');
    });

    it('still returns a renderable, closest-reachable color', () => {
      expect(new Color(result.adjustedColor).inGamut('srgb')).toBe(true);
    });
  });

  describe('--allow-desaturation', () => {
    const target = 8;
    const escalated = run('#070e16', 'oklch(0.79 0.22 25)', target);
    const applied = run('#070e16', 'oklch(0.79 0.22 25)', target, true);

    it('applies what the escalation quoted', () => {
      expect(applied.success).toBe(true);
      expect(applied.oklch!.c).toBeCloseTo(escalated.resolvableBy!.chroma, 6);
    });

    it('quote and fix agree on the lightness as well as the cost', () => {
      // Both run the same search, so they cannot disagree about what the fix is
      // or what it costs.
      expect(applied.oklch!.l).toBeCloseTo(escalated.resolvableBy!.lightness, 6);
      expect(applied.deltaE).toBe(escalated.resolvableBy!.deltaE);
    });

    it('keeps more chroma by letting lightness move', () => {
      // Lightness is always free to move — adjusting it is what `find` does, and
      // `--allow-desaturation` grants permission for *chroma*. Pinning the
      // chroma search to one lightness enforces a constraint nobody asked for,
      // and costs saturation rather than saving it: on this pair, holding
      // lightness fixed needs chroma 0.086 where letting it move keeps 0.106.
      const heldFixed = 0.086;
      expect(applied.oklch!.c).toBeGreaterThan(heldFixed);
    });

    it('records chroma as an adjusted axis', () => {
      expect(applied.axesAdjusted).toContain('chroma');
    });

    it('meets the target it was given', () => {
      expect(Math.abs(applied.actualContrast)).toBeGreaterThanOrEqual(target);
    });
  });

  describe('the case issue #9 was filed about', () => {
    // `find "oklch(1 0 0)" "oklch(0.45 0.22 25)" --target 9.5` returned the
    // input unchanged at exit 1. At the reference's own lightness contrast tops
    // out at 6.4 even at chroma 0, so no single-axis move solves it — but
    // C≈0.15 at L≈0.37 reaches 9.5.
    const base = 'oklch(1 0 0)';
    const ref = 'oklch(0.45 0.22 25)';

    it('is reported as resolvable rather than as a dead end', () => {
      const result = run(base, ref, 9.5);
      expect(result.reason).toBe('lightness-exhausted');
      expect(result.resolvableBy).toBeDefined();
      expect(result.resolvableBy!.lightness).toBeLessThan(0.45);
    });

    it('is solved when desaturation is permitted', () => {
      const result = run(base, ref, 9.5, true);
      expect(result.success).toBe(true);
      expect(Math.abs(result.actualContrast)).toBeGreaterThanOrEqual(9.5);
      expect(result.axesAdjusted).toEqual(expect.arrayContaining(['chroma', 'lightness']));
    });

    it('returns a renderable color, never the unusable input', () => {
      const result = run(base, ref, 9.5, true);
      expect(new Color(result.adjustedColor).inGamut('srgb')).toBe(true);
      expect(result.adjustedColor).not.toBe(ref);
    });
  });

  describe('reason distinguishes a constraint from an impossibility', () => {
    it('unreachable when the target exceeds what any color can reach', () => {
      // Maximum contrast against any base is at black or white, so this bounds
      // the whole space — no reference color can help, only a different base.
      const result = run('oklch(0.50 0 0)', '#808080', 21);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('unreachable');
      expect(result.resolvableBy).toBeUndefined();
    });

    it('does not claim unreachable when only the caller\'s constraint bound it', () => {
      const result = run('#070e16', 'oklch(0.79 0.22 25)', 8);
      expect(result.reason).toBe('lightness-exhausted');
    });
  });

  describe('in-gamut references behave as before', () => {
    it('succeeds and reports no normalization', () => {
      const result = run('#ffffff', '#3b82f6', 4.5);
      expect(result.success).toBe(true);
      expect(result.gamut.outOfGamut).toBe(false);
      expect(result.gamut.measured).toBeUndefined();
    });

    it('returns the reference untouched when it already sits on the target', () => {
      // `find` minimizes overshoot, so a reference far above the target still
      // moves toward it — that is the documented contract. Nothing should move
      // only when the reference is already within tolerance of the floor.
      const own = getServices().colorMetricsService.getContrast('#3b82f6', '#ffffff', 'okca')!;
      const result = run('#ffffff', '#3b82f6', Math.abs(own));
      expect(result.success).toBe(true);
      expect(result.axesAdjusted).toEqual([]);
      expect(result.deltaE).toBe(0);
    });
  });
});
