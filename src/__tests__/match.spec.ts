import { getServices } from '../services';

describe('match command (via services)', () => {
  const { colorUtilService } = getServices();

  it('should match chromas between two colors', () => {
    const result = colorUtilService.matchChromas(['#ff0000', '#0000ff']);
    expect(result.success).toBe(true);
    expect(result.colors).not.toBeNull();
    expect(result.colors).toHaveLength(2);
  });

  it('should return a numeric chroma value', () => {
    const result = colorUtilService.matchChromas(['#ff0000', '#0000ff']);
    expect(typeof result.chroma).toBe('number');
    expect(result.chroma).toBeGreaterThan(0);
  });

  it('should return hex colors in the result', () => {
    const result = colorUtilService.matchChromas(['#ff0000', '#0000ff']);
    expect(result.colors![0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.colors![1]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('should fail gracefully for invalid first color', () => {
    const result = colorUtilService.matchChromas(['invalid', '#0000ff']);
    expect(result.success).toBe(false);
    expect(result.colors).toBeNull();
  });

  it('should fail gracefully for invalid second color', () => {
    const result = colorUtilService.matchChromas(['#ff0000', 'invalid']);
    expect(result.success).toBe(false);
    expect(result.colors).toBeNull();
  });
});
