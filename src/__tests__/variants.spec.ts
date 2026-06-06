import { getServices } from '../services';

describe('variants command (via services)', () => {
  const { colorUtilService } = getServices();

  it('should generate OKLCH variant grid', () => {
    const result = colorUtilService.generateAllOklchVariants('#ff0000', 3, 2, 'oklch');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].length).toBeGreaterThan(0);
  });

  it('should generate HSL variant grid', () => {
    const result = colorUtilService.generateAllOklchVariants('#ff0000', 3, 2, 'hsl');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include color metadata in each cell', () => {
    const result = colorUtilService.generateAllOklchVariants('#3b82f6', 2, 2, 'oklch');
    const cell = result[0][0];
    expect(cell).toHaveProperty('color');
    expect(cell).toHaveProperty('lightness');
    expect(cell).toHaveProperty('chroma');
    expect(cell).toHaveProperty('hue');
    expect(cell).toHaveProperty('deltaE');
    expect(cell).toHaveProperty('deltaChroma');
    expect(cell).toHaveProperty('deltaLightness');
  });

  it('should throw for invalid color', () => {
    expect(() =>
      colorUtilService.generateAllOklchVariants('not-a-color', 3, 2),
    ).toThrow();
  });

  it('should produce hex strings in cells with valid colors', () => {
    const result = colorUtilService.generateAllOklchVariants('#ff0000', 3, 2, 'oklch');
    const nonEmptyCells = result.flat().filter((c) => c.color !== '');
    expect(nonEmptyCells.length).toBeGreaterThan(0);
    for (const cell of nonEmptyCells) {
      expect(cell.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
