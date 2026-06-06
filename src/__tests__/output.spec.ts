import { formatContrast, formatMeta, formatPair, colorSwatch } from '../formatters/human';

describe('human formatters', () => {
  describe('colorSwatch', () => {
    it('should produce ANSI escape codes for valid hex', () => {
      const swatch = colorSwatch('#ff0000');
      expect(swatch).toContain('\x1b[38;2;255;0;0m');
      expect(swatch).toContain('██');
      expect(swatch).toContain('\x1b[0m');
    });

    it('should return plain blocks for invalid hex', () => {
      expect(colorSwatch('bad')).toBe('██');
    });
  });

  describe('formatContrast', () => {
    it('should format contrast output', () => {
      const result = formatContrast({
        contrast: 21,
        type: 'okca',
        colorOne: '#ffffff',
        colorTwo: '#000000',
      });
      expect(result).toContain('Contrast (OKCA): 21');
      expect(result).toContain('#ffffff');
      expect(result).toContain('#000000');
    });
  });

  describe('formatMeta', () => {
    it('should format color metadata', () => {
      const result = formatMeta({
        color: '#3b82f6',
        lightness: 0.62,
        chroma: 0.19,
        hue: 259.81,
        saturation: 30.17,
      });
      expect(result).toContain('Lightness:  0.62');
      expect(result).toContain('Chroma:     0.19');
      expect(result).toContain('Hue:        259.81');
      expect(result).toContain('Saturation: 30.17%');
    });
  });

  describe('formatPair', () => {
    it('should format color pair output', () => {
      const result = formatPair({
        colorOne: '#2d4a7c',
        colorTwo: '#f0e8d6',
        contrast: 10,
      });
      expect(result).toContain('Color Pair (OKCA: 10)');
      expect(result).toContain('Foreground: #2d4a7c');
      expect(result).toContain('Background: #f0e8d6');
    });
  });
});
