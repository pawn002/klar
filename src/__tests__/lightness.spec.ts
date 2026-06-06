import { getServices } from '../services';

describe('lightness command (via services)', () => {
  const { colorUtilService } = getServices();

  it('should return min/max lightness for a valid color', () => {
    const result = colorUtilService.getMinMaxLight('#3b82f6');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('originalCoords');
    expect(result).toHaveProperty('lightMin');
    expect(result).toHaveProperty('lightMax');
  });

  it('should have lightMin <= lightMax', () => {
    const result = colorUtilService.getMinMaxLight('#3b82f6');
    expect(result!.lightMin).toBeLessThanOrEqual(result!.lightMax);
  });

  it('should return originalCoords as a 3-element array', () => {
    const result = colorUtilService.getMinMaxLight('#ff0000');
    expect(result!.originalCoords).toHaveLength(3);
  });

  it('should throw for invalid color', () => {
    expect(() => colorUtilService.getMinMaxLight('not-a-color')).toThrow();
  });

  it('should have lightMin >= 0', () => {
    const result = colorUtilService.getMinMaxLight('#ff0000');
    expect(result!.lightMin).toBeGreaterThanOrEqual(0);
  });

  it('should have lightMax <= 1', () => {
    const result = colorUtilService.getMinMaxLight('#ff0000');
    expect(result!.lightMax).toBeLessThanOrEqual(1);
  });
});
