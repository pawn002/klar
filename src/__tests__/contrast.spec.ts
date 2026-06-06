import { getServices } from '../services';

describe('contrast command (via services)', () => {
  const { colorMetricsService, colorUtilService } = getServices();

  describe('OKCA contrast', () => {
    it('should calculate OKCA contrast for black on white', () => {
      const result = colorMetricsService.getContrast('#ffffff', '#000000', 'okca');
      expect(result).not.toBeNull();
      expect(typeof result).toBe('number');
    });

    it('should return high contrast for black on white', () => {
      const result = colorMetricsService.getContrast('#ffffff', '#000000', 'okca');
      expect(result).toBeGreaterThan(13);
    });

    it('should return 1 for identical colors (minimum WCAG ratio)', () => {
      const result = colorMetricsService.getContrast('#ffffff', '#ffffff', 'okca');
      expect(result).toBe(1);
    });

    it('should calculate raw OKCA contrast', () => {
      const result = colorMetricsService.calcRawOkcaContrast('#ffffff', '#000000');
      expect(result).not.toBeNull();
      expect(typeof result).toBe('number');
    });
  });

  describe('WCAG 2.x contrast', () => {
    it('should calculate WCAG 2.x contrast for black on white', () => {
      const result = colorMetricsService.getContrast('#ffffff', '#000000', 'wcag2');
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(1);
    });

    it('should return 1 for identical colors', () => {
      const result = colorMetricsService.getContrast('#ffffff', '#ffffff', 'wcag2');
      expect(result).toBe(1);
    });
  });

  describe('Delta E', () => {
    it('should calculate deltaE for different colors', () => {
      const result = colorMetricsService.getContrast('#ffffff', '#000000', 'deltaE');
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(0);
    });

    it('should return 0 for identical colors', () => {
      const result = colorMetricsService.getContrast('#ffffff', '#ffffff', 'deltaE');
      expect(result).toBe(0);
    });
  });

  describe('oklch string inputs', () => {
    const white = 'oklch(1 0 0)';
    const black = 'oklch(0 0 0)';
    const red = 'oklch(0.6279 0.2577 29.23)'; // ≈ #ff0000

    it('parseColor accepts oklch string', () => {
      expect(colorUtilService.parseColor(white)).not.toBeNull();
    });

    it('calcDeltaE with oklch inputs matches equivalent hex inputs', () => {
      const deltaOklch = colorUtilService.calcDeltaE(white, black);
      const deltaHex = colorUtilService.calcDeltaE('#ffffff', '#000000');
      expect(deltaOklch).not.toBeNull();
      expect(deltaOklch).toBe(deltaHex);
    });

    it('calcWcag2 with oklch inputs matches equivalent hex inputs', () => {
      const wcagOklch = colorUtilService.calcWcag2(white, black);
      const wcagHex = colorUtilService.calcWcag2('#ffffff', '#000000');
      expect(wcagOklch).not.toBeNull();
      expect(wcagOklch).toBe(wcagHex);
    });

    it('getContrast end-to-end with oklch inputs returns ~21 for white/black (okca)', () => {
      const result = colorMetricsService.getContrast(white, black, 'okca');
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(13);
    });

    it('getContrast end-to-end with oklch inputs (wcag2) white on black ≈ 21', () => {
      const result = colorMetricsService.getContrast(white, black, 'wcag2');
      expect(result).not.toBeNull();
      expect(result).toBeCloseTo(21, 0);
    });

    it('calcWcag2 with oklch red returns reasonable contrast against white', () => {
      const result = colorUtilService.calcWcag2('#ffffff', red);
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(1);
    });
  });

  describe('color validation', () => {
    it('should return null for invalid first color', () => {
      const result = colorMetricsService.getContrast('not-a-color', '#000000', 'okca');
      expect(result).toBeNull();
    });

    it('should return null for invalid second color', () => {
      const result = colorMetricsService.getContrast('#ffffff', 'bad', 'okca');
      expect(result).toBeNull();
    });

    it('should parse hex colors', () => {
      expect(colorUtilService.parseColor('#ff0000')).not.toBeNull();
    });

    it('should parse rgb colors', () => {
      expect(colorUtilService.parseColor('rgb(255, 0, 0)')).not.toBeNull();
    });

    it('should return null for invalid colors', () => {
      expect(colorUtilService.parseColor('not-a-color')).toBeNull();
    });
  });
});
