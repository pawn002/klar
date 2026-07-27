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

  // `match` rebuilds one color at the other's chroma and returns the other
  // untouched, so the reported `chroma` must be the chroma of whichever input
  // came back unchanged — the chroma *source*. It previously echoed color1's
  // original chroma even when color1 was the color being adjusted, reporting 0
  // for every neutral-first pair. Asserting only `> 0` did not catch that.
  //
  // Deliberately compares against the untouched *input* rather than re-reading
  // the output hex: these specs run on the colorjs.io mock, whose oklch->hex
  // round-trip is too lossy to preserve chroma.
  it.each([
    ['neutral first, chromatic second', '#666666', '#3b82f6'],
    ['neutral first, muted second',     '#808080', '#7f9b7f'],
    ['chromatic first, neutral second', '#3b82f6', '#6a6d71'],
    ['both chromatic',                  '#ff6600', '#3b82f6'],
    ['saturated opposites',             '#ff0000', '#0000ff'],
  ])('reports the chroma source, not the adjusted color (%s)', (_label, a, b) => {
    const result = colorUtilService.matchChromas([a, b]);
    expect(result.success).toBe(true);

    const chromaOf = (hex: string) =>
      colorUtilService.parseColor(hex)!.to('oklch').coords[1];
    const [outA, outB] = result.colors!;

    // Exactly one input is returned as-is; that one supplied the chroma.
    const untouched = outA === a ? a : b;
    expect([a, b]).toContain(untouched);
    expect(result.chroma).toBeCloseTo(chromaOf(untouched), 3);
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
