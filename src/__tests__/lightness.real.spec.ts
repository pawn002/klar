import { getServices } from '../services';

/**
 * Real-library specs for the lightness range. The empty-range case turns on
 * exact sRGB gamut boundaries, which the colorjs.io mock only approximates —
 * so it cannot be pinned in the mocked project.
 */
describe('lightness range (issue #9, third instance)', () => {
  const { colorUtilService } = getServices();

  describe('no lightness renders at this chroma', () => {
    // The defect: this returned `{ lightMin: 0.5, lightMax: 0.5 }` and exit 0,
    // which reads as "the usable range is exactly 0.5" — a confident, specific,
    // false answer. Nothing renders at chroma 0.9 at any lightness.
    const result = colorUtilService.getMinMaxLight('oklch(0.5 0.9 25)')!;

    it('reports no range rather than inventing one', () => {
      expect(result.lightMin).toBeNull();
      expect(result.lightMax).toBeNull();
    });

    it('never reports the input lightness as the range', () => {
      expect(result.lightMin).not.toBe(0.5);
      expect(result.lightMax).not.toBe(0.5);
    });

    it('flags the input as out of gamut', () => {
      expect(result.outOfGamut).toBe(true);
    });
  });

  describe('out-of-gamut input that still has a usable range', () => {
    // oklch(0.45 0.22 25) is not renderable at L=0.45, but the same chroma and
    // hue do render between roughly 0.54 and 0.67. The honest answer is that
    // band — a range that excludes the input's own lightness.
    const result = colorUtilService.getMinMaxLight('oklch(0.45 0.22 25)')!;

    it('reports the band that does render', () => {
      expect(result.lightMin).toBeGreaterThan(0.5);
      expect(result.lightMax).toBeLessThan(0.7);
      expect(result.lightMin!).toBeLessThan(result.lightMax!);
    });

    it('excludes the input lightness from the reported range', () => {
      expect(result.originalCoords[0]).toBeLessThan(result.lightMin!);
    });

    it('flags the input as out of gamut', () => {
      expect(result.outOfGamut).toBe(true);
    });
  });

  describe('ordinary in-gamut color', () => {
    const result = colorUtilService.getMinMaxLight('#3b82f6')!;

    it('reports a real range', () => {
      expect(result.lightMin).not.toBeNull();
      expect(result.lightMax).not.toBeNull();
      expect(result.lightMin!).toBeLessThan(result.lightMax!);
    });

    it('is not flagged out of gamut', () => {
      expect(result.outOfGamut).toBe(false);
    });

    it('contains the input lightness', () => {
      expect(result.originalCoords[0]).toBeGreaterThanOrEqual(result.lightMin!);
      expect(result.originalCoords[0]).toBeLessThanOrEqual(result.lightMax!);
    });
  });
});
