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

    it('quotes and applies at the reference lightness, not a drifted one', () => {
      // The two must agree on the cost, which they only do if both search from
      // the same starting point.
      const [refL] = new Color('oklch(0.79 0.22 25)').to('oklch').coords.map(Number);
      expect(applied.oklch!.l).toBeCloseTo(refL, 6);
      expect(applied.deltaE).toBe(escalated.resolvableBy!.deltaE);
    });

    it('records chroma as an adjusted axis', () => {
      expect(applied.axesAdjusted).toContain('chroma');
    });

    it('meets the target it was given', () => {
      expect(Math.abs(applied.actualContrast)).toBeGreaterThanOrEqual(target);
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
