import { getServices } from '../services';

describe('pair command (via services)', () => {
  const { colorUtilService, colorMetricsService } = getServices();

  it('should generate a color pair', () => {
    const pair = colorUtilService.getRandomColorPair();
    expect(pair).toHaveLength(2);
    expect(pair[0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(pair[1]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('should generate different colors', () => {
    const pair = colorUtilService.getRandomColorPair();
    expect(pair[0]).not.toBe(pair[1]);
  });

  it('should produce a pair with calculable contrast', () => {
    const pair = colorUtilService.getRandomColorPair();
    const contrast = colorMetricsService.calcRawOkcaContrast(pair[0], pair[1]);
    expect(contrast).not.toBeNull();
    expect(typeof contrast).toBe('number');
  });

  describe('matchChromas', () => {
    it('should match chromas between two colors', () => {
      const result = colorUtilService.matchChromas(['#ff0000', '#0000ff']);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('chroma');
    });

    it('should return success with valid colors', () => {
      const result = colorUtilService.matchChromas(['#ff0000', '#0000ff']);
      expect(result.success).toBe(true);
      expect(result.colors).not.toBeNull();
      expect(result.colors).toHaveLength(2);
    });
  });
});
