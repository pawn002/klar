import { getServices } from '../services';

describe('meta command (via services)', () => {
  const { colorUtilService } = getServices();

  it('should return OKLCH metadata for a hex color', () => {
    const meta = colorUtilService.getColorMeta('#ff0000');
    expect(meta).not.toBeNull();
    expect(meta).toHaveProperty('lightness');
    expect(meta).toHaveProperty('chroma');
    expect(meta).toHaveProperty('hue');
    expect(meta).toHaveProperty('saturation');
  });

  it('should return numeric values', () => {
    const meta = colorUtilService.getColorMeta('#3b82f6');
    expect(meta).not.toBeNull();
    expect(typeof meta!.lightness).toBe('number');
    expect(typeof meta!.chroma).toBe('number');
    expect(typeof meta!.hue).toBe('number');
    expect(typeof meta!.saturation).toBe('number');
  });

  it('should return null for invalid color', () => {
    const meta = colorUtilService.getColorMeta('not-a-color');
    expect(meta).toBeNull();
  });

  it('should return 0 lightness for black', () => {
    const meta = colorUtilService.getColorMeta('#000000');
    expect(meta).not.toBeNull();
    expect(meta!.lightness).toBe(0);
  });

  it('should return 1 lightness for white (approx)', () => {
    const meta = colorUtilService.getColorMeta('#ffffff');
    expect(meta).not.toBeNull();
    // White in OKLCH has lightness ~1.0
    expect(Number(meta!.lightness)).toBeGreaterThan(0.9);
  });

  it('should handle rgb format', () => {
    const meta = colorUtilService.getColorMeta('rgb(59, 130, 246)');
    expect(meta).not.toBeNull();
  });

  it('should return correct L/C/H for oklch string input', () => {
    const meta = colorUtilService.getColorMeta('oklch(0.627 0.258 29.2)');
    expect(meta).not.toBeNull();
    expect(meta!.lightness).toBeCloseTo(0.63, 1);
    expect(meta!.chroma).toBeCloseTo(0.26, 1);
    expect(meta!.hue).toBeCloseTo(29.2, 0);
  });

  it('should return lightness 1 for oklch white', () => {
    const meta = colorUtilService.getColorMeta('oklch(1 0 0)');
    expect(meta).not.toBeNull();
    expect(meta!.lightness).toBe(1);
  });

  it('should return lightness 0 for oklch black', () => {
    const meta = colorUtilService.getColorMeta('oklch(0 0 0)');
    expect(meta).not.toBeNull();
    expect(meta!.lightness).toBe(0);
  });
});
