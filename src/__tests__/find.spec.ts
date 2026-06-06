import { getServices } from '../services';

describe('find command (via services)', () => {
  const { colorUtilService } = getServices();

  it('should return a result object', () => {
    const result = colorUtilService.findColorForTargetContrast({
      baseColor: '#ffffff',
      referenceColor: '#3b82f6',
      targetContrast: 7,
      contrastType: 'okca',
    });
    expect(result).toHaveProperty('adjustedColor');
    expect(result).toHaveProperty('actualContrast');
    expect(result).toHaveProperty('iterations');
    expect(result).toHaveProperty('success');
  });

  it('should return a hex color as adjustedColor', () => {
    const result = colorUtilService.findColorForTargetContrast({
      baseColor: '#ffffff',
      referenceColor: '#808080',
      targetContrast: 4.5,
      contrastType: 'okca',
    });
    expect(result.adjustedColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('should include oklch in result', () => {
    const result = colorUtilService.findColorForTargetContrast({
      baseColor: '#ffffff',
      referenceColor: '#808080',
      targetContrast: 4.5,
      contrastType: 'okca',
    });
    expect(result.oklch).toBeDefined();
    expect(result.oklch).toHaveProperty('l');
    expect(result.oklch).toHaveProperty('c');
    expect(result.oklch).toHaveProperty('h');
  });

  it('should throw for invalid base color', () => {
    expect(() =>
      colorUtilService.findColorForTargetContrast({
        baseColor: 'invalid',
        referenceColor: '#808080',
        targetContrast: 4.5,
        contrastType: 'okca',
      }),
    ).toThrow('Invalid base color');
  });

  it('should throw for invalid reference color', () => {
    expect(() =>
      colorUtilService.findColorForTargetContrast({
        baseColor: '#ffffff',
        referenceColor: 'invalid',
        targetContrast: 4.5,
        contrastType: 'okca',
      }),
    ).toThrow('Invalid reference color');
  });

  it('should respect tolerance option', () => {
    const result = colorUtilService.findColorForTargetContrast({
      baseColor: '#ffffff',
      referenceColor: '#808080',
      targetContrast: 4.5,
      contrastType: 'okca',
      tolerance: 0.5,
    });
    expect(result).toHaveProperty('success');
    expect(typeof result.iterations).toBe('number');
  });

  // Regression: issue #6 — find returned a below-target color and marked it ✓.
  // The target is a floor; success must mean actualContrast >= target.
  describe('floor semantics (issue #6)', () => {
    const contrastOf = (fg: string, bg: string) =>
      colorUtilService['calculateContrastByType'](fg, bg, 'okca') as number;

    it('never reports success with a contrast below the target', () => {
      const bg = 'oklch(0.24 0.03 248.99)';
      for (const target of [2.8, 3.0, 3.1]) {
        const result = colorUtilService.findColorForTargetContrast({
          baseColor: bg,
          referenceColor: 'oklch(0.56 0 0)',
          targetContrast: target,
          contrastType: 'okca',
        });
        expect(result.success).toBe(true);
        // The reported contrast and the returned color's real contrast both clear the floor.
        expect(Math.abs(result.actualContrast)).toBeGreaterThanOrEqual(target);
        expect(Math.abs(contrastOf(result.adjustedColor, bg))).toBeGreaterThanOrEqual(target);
      }
    });

    it('actualContrast matches the returned color, not the input', () => {
      const bg = 'oklch(0.24 0.03 248.99)';
      const result = colorUtilService.findColorForTargetContrast({
        baseColor: bg,
        referenceColor: 'oklch(0.56 0 0)',
        targetContrast: 3.0,
        contrastType: 'okca',
      });
      expect(Math.abs(result.actualContrast)).toBeCloseTo(
        Math.abs(contrastOf(result.adjustedColor, bg)),
        1,
      );
    });

    it('marks success:false when the target is unachievable, returning the closest color', () => {
      // 21 is above OKCA's achievable range for this background.
      const bg = 'oklch(0.50 0 0)';
      const result = colorUtilService.findColorForTargetContrast({
        baseColor: bg,
        referenceColor: '#808080',
        targetContrast: 21,
        contrastType: 'okca',
      });
      expect(result.success).toBe(false);
      expect(result.adjustedColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(Math.abs(result.actualContrast)).toBeLessThan(21);
    });
  });
});
