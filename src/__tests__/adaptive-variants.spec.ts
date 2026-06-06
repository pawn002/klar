import { getServices } from '../services';

describe('generateAdaptiveVariants', () => {
  const { colorUtilService } = getServices();

  it('should return only in-gamut cells (no empty color strings)', () => {
    const grid = colorUtilService.generateAdaptiveVariants('#3b82f6');
    for (const row of grid) {
      for (const cell of row) {
        expect(cell.color).not.toBe('');
        expect(cell.color).toMatch(/^#[0-9a-f]{3,8}$/i);
      }
    }
  });

  it('should include the base color in the grid', () => {
    const grid = colorUtilService.generateAdaptiveVariants('#808080');
    const allCells = grid.flat();
    // #808080 is neutral gray (C≈0). The grid always includes the base
    // chroma level (C=0), so at least one cell must have near-zero chroma.
    // (The exact hex depends on the OKLCH round-trip in the mock.)
    expect(allCells.some(c => c.chroma < 0.001)).toBe(true);
  });

  it('should have deltaE >= 11 between lightness neighbors within each column', () => {
    const grid = colorUtilService.generateAdaptiveVariants('#808080', 11);
    // Reconstruct columns: cells at column index c share the same chroma
    const maxCols = Math.max(...grid.map(r => r.length));
    for (let c = 0; c < maxCols; c++) {
      const colCells = grid.map(r => r[c]).filter(cell => cell !== undefined);
      for (let i = 0; i < colCells.length - 1; i++) {
        const de = colorUtilService.calcDeltaE(colCells[i].color, colCells[i + 1].color);
        expect(de).not.toBeNull();
        expect(de!).toBeGreaterThanOrEqual(11);
      }
    }
  });

  it('should have each column at constant chroma', () => {
    const grid = colorUtilService.generateAdaptiveVariants('#808080', 11);
    const maxCols = Math.max(...grid.map(r => r.length));
    for (let c = 0; c < maxCols; c++) {
      const colCells = grid.map(r => r[c]).filter(cell => cell !== undefined);
      if (colCells.length < 2) continue;
      const chroma = colCells[0].chroma;
      for (const cell of colCells) {
        expect(cell.chroma).toBe(chroma);
      }
    }
  });

  it('should produce more cells for neutral colors than chromatic ones', () => {
    const grayGrid = colorUtilService.generateAdaptiveVariants('#808080');
    const blueGrid = colorUtilService.generateAdaptiveVariants('#3b82f6');
    const grayCells = grayGrid.flat().length;
    const blueCells = blueGrid.flat().length;
    expect(grayCells).toBeGreaterThan(blueCells);
  });

  it('should produce fewer cells with a larger minDelta', () => {
    const small = colorUtilService.generateAdaptiveVariants('#808080', 11);
    const large = colorUtilService.generateAdaptiveVariants('#808080', 20);
    expect(small.flat().length).toBeGreaterThan(large.flat().length);
  });

  it('should throw for invalid color', () => {
    expect(() => colorUtilService.generateAdaptiveVariants('notacolor')).toThrow();
  });

  it('should produce at least 1 row with at least 1 cell', () => {
    const grid = colorUtilService.generateAdaptiveVariants('#ff6600');
    expect(grid.length).toBeGreaterThanOrEqual(1);
    expect(grid[0].length).toBeGreaterThanOrEqual(1);
  });

  it('should populate all cell fields', () => {
    const grid = colorUtilService.generateAdaptiveVariants('#e94560');
    const cell = grid[0][0];
    expect(cell).toHaveProperty('color');
    expect(cell).toHaveProperty('lightness');
    expect(cell).toHaveProperty('chroma');
    expect(cell).toHaveProperty('hue');
    expect(cell).toHaveProperty('deltaE');
    expect(cell).toHaveProperty('deltaChroma');
    expect(cell).toHaveProperty('deltaLightness');
    expect(typeof cell.lightness).toBe('number');
    expect(typeof cell.chroma).toBe('number');
    expect(typeof cell.hue).toBe('number');
  });

  it('should respect custom minDelta threshold', () => {
    const grid = colorUtilService.generateAdaptiveVariants('#808080', 20);
    // Verify lightness neighbors within each column meet the higher threshold
    const maxCols = Math.max(...grid.map(r => r.length));
    for (let c = 0; c < maxCols; c++) {
      const colCells = grid.map(r => r[c]).filter(cell => cell !== undefined);
      for (let i = 0; i < colCells.length - 1; i++) {
        const de = colorUtilService.calcDeltaE(colCells[i].color, colCells[i + 1].color);
        expect(de).not.toBeNull();
        expect(de!).toBeGreaterThanOrEqual(20);
      }
    }
  });
});
