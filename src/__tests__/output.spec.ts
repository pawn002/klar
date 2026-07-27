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

    // The swatch used to accept only 6-digit hex and silently emit an
    // uncolored block for everything else — including `#fff` and
    // `rgb(...)`, which the README and the commands' own --help use.
    it('renders 3-digit shorthand identically to its 6-digit form', () => {
      expect(colorSwatch('#fff')).toBe(colorSwatch('#ffffff'));
      expect(colorSwatch('#000')).toBe(colorSwatch('#000000'));
      expect(colorSwatch('#abc')).toBe(colorSwatch('#aabbcc'));
    });

    it.each([
      ['3-digit hex', '#f00'],
      ['6-digit hex', '#ff0000'],
      ['rgb()',       'rgb(59, 130, 246)'],
      ['oklch()',     'oklch(50% 0.2 240)'],
      ['named color', 'rebeccapurple'],
    ])('colors the swatch for %s', (_label, input) => {
      expect(colorSwatch(input)).toMatch(/^\x1b\[38;2;\d{1,3};\d{1,3};\d{1,3}m██\x1b\[0m$/);
    });

    // The swatch must color exactly what klar accepts. Bare hex without a `#`
    // is rejected by `klar contrast` (exit 2), so it must not render either.
    it.each([['bare 3-digit', 'bad'], ['bare 6-digit', 'ff0000'], ['nonsense', 'notacolor']])(
      'returns a plain block for %s, which klar rejects as input',
      (_label, input) => {
        expect(colorSwatch(input)).toBe('██');
      },
    );
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
