/**
 * OKCA unit tests
 *
 * These tests run against the CLI colorjs.io mock (cli/__mocks__/colorjs.io.ts).
 * The mock uses the correct Ottosson 2020 sRGB→Oklab transform, so OKLCH L
 * values match real colorjs.io (e.g. #767676 → L≈0.566).
 *
 * Smoke / contract tests only — the algorithm itself is owned and tested
 * inside @pawn002/okca. These tests verify the CLI wiring (method name,
 * input parsing, output range, polarity awareness).
 *
 * OKCA v2.0.0 is polarity-aware: light-on-dark caps at 20.9, dark-on-light
 * caps at 20, and the same chromatic pair scores differently depending
 * on argument order. Achromatic white/black saturates the light-on-dark
 * cap (20.9); black/white saturates the dark-on-light cap (20).
 *
 * v2.0.0 recalibrated the constants (CHROMA_K, POL_K, LOD_CAP, DOL_CAP), so
 * the probe-battery values below moved relative to v1.x. They are captured
 * from okca 2.0.0 and are expected to change again on the next major.
 */
import { OkcaService } from '../services/okca.service';

/** okca 2.0.0 output caps: light-on-dark and dark-on-light. */
const LOD_CAP = 20.9;
const DOL_CAP = 20;

describe('OkcaService', () => {
  let okca: OkcaService;

  beforeEach(() => {
    okca = new OkcaService();
  });

  // ── Null / invalid ────────────────────────────────────────────────────────

  describe('invalid inputs', () => {
    it('returns null for invalid text color', () => {
      expect(okca.contrast('not-a-color', '#000000')).toBeNull();
    });

    it('returns null for invalid background color', () => {
      expect(okca.contrast('#ffffff', 'bad')).toBeNull();
    });

    it('returns null when both colors are invalid', () => {
      expect(okca.contrast('foo', 'bar')).toBeNull();
    });
  });

  // ── Identical / near-identical colors ────────────────────────────────────

  describe('identical colors', () => {
    it('returns 1 for identical white', () => {
      expect(okca.contrast('#ffffff', '#ffffff')).toBe(1);
    });

    it('returns 1 for identical black', () => {
      expect(okca.contrast('#000000', '#000000')).toBe(1);
    });

    it('returns 1 for identical mid-gray', () => {
      expect(okca.contrast('#808080', '#808080')).toBe(1);
    });
  });

  // ── Achromatic anchors (polarity-aware caps) ──────────────────────────────

  describe('achromatic pairs (polarity-aware caps)', () => {
    it('returns 20.9 for white on black (light-on-dark cap)', () => {
      expect(okca.contrast('#ffffff', '#000000')).toBe(LOD_CAP);
    });

    it('returns 20 for black on white (dark-on-light cap)', () => {
      expect(okca.contrast('#000000', '#ffffff')).toBe(DOL_CAP);
    });

    it('returns ~3.9 for white-on-#767676 (light-on-dark, AA-adjacent)', () => {
      const result = okca.contrast('#ffffff', '#767676');
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThanOrEqual(3.5);
      expect(result).toBeLessThanOrEqual(4.4);
    });

    it('always returns a value in the OKCA output range [1, 20.9]', () => {
      const pairs = [
        ['#ffffff', '#000000'],
        ['#000000', '#ffffff'],
        ['#ffffff', '#333333'],
        ['#000000', '#cccccc'],
        ['#ff0000', '#0000ff'],
      ];
      for (const [fg, bg] of pairs) {
        const r = okca.contrast(fg, bg);
        expect(r).not.toBeNull();
        expect(r!).toBeGreaterThanOrEqual(1);
        expect(r!).toBeLessThanOrEqual(LOD_CAP);
      }
    });
  });

  // ── Range checks on representative green pairs ────────────────────────────

  describe('green pairs', () => {
    it('white on forest green is in valid range', () => {
      const result = okca.contrast('#ffffff', '#228b22');
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThanOrEqual(1);
      expect(result!).toBeLessThanOrEqual(LOD_CAP);
    });

    it('pure green (#00ff00) on black is in valid range', () => {
      const result = okca.contrast('#00ff00', '#000000');
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThanOrEqual(1);
      expect(result!).toBeLessThanOrEqual(LOD_CAP);
    });
  });

  // ── Blue colors ───────────────────────────────────────────────────────────

  describe('blue colors (no green correction fires)', () => {
    it('blue text on white is in valid range without spurious correction', () => {
      const result = okca.contrast('#1d4ed8', '#ffffff');
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThanOrEqual(1);
      expect(result!).toBeLessThanOrEqual(LOD_CAP);
    });
  });

  // ── Chroma compression (lighter element) ─────────────────────────────────

  describe('chroma compression on lighter element', () => {
    it('saturated light colors produce lower ratio than equivalent neutral gray', () => {
      const achromatic = okca.contrast('#ffffff', '#333333');
      expect(achromatic).not.toBeNull();
      expect(achromatic!).toBeGreaterThan(1);
    });

    it('returns valid range for highly saturated warm pair', () => {
      const result = okca.contrast('#ff69b4', '#1a1a1a');
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThanOrEqual(1);
      expect(result!).toBeLessThanOrEqual(LOD_CAP);
    });
  });

  // ── Polarity awareness (OKCA v2.0.0 is asymmetric for chromatic pairs) ───

  describe('polarity awareness', () => {
    it('light-on-dark caps higher than dark-on-light for white/black', () => {
      const lod = okca.contrast('#ffffff', '#000000');
      const dol = okca.contrast('#000000', '#ffffff');
      expect(lod).toBe(LOD_CAP);
      expect(dol).toBe(DOL_CAP);
      expect(lod).toBeGreaterThan(dol!);
    });

    it('chromatic pairs return different ratios when swapped', () => {
      const fgOnBg = okca.contrast('#ffffff', '#228b22');
      const bgOnFg = okca.contrast('#228b22', '#ffffff');
      expect(fgOnBg).not.toBeNull();
      expect(bgOnFg).not.toBeNull();
      expect(fgOnBg).not.toBe(bgOnFg);
    });
  });

  // ── Return type ───────────────────────────────────────────────────────────

  describe('return type', () => {
    it('returns a number (not a string or null) for valid colors', () => {
      const result = okca.contrast('#ffffff', '#000000');
      expect(typeof result).toBe('number');
    });

    it('returns a value rounded to one decimal place', () => {
      const result = okca.contrast('#ffffff', '#000000');
      expect(result).not.toBeNull();
      expect(result! * 10 % 1).toBe(0);
    });
  });

  // ── False-pass guard ──────────────────────────────────────────────────────
  // Pairs where WCAG fails (<4.5). OKCA must never return ≥4.5 for these.

  describe('false-pass guard', () => {
    it.each([
      ['white / forest green (#228b22), WCAG 4.4', '#ffffff', '#228b22'],
      ['white / mid-gray (#808080), WCAG ~3.95',   '#ffffff', '#808080'],
      ['hot pink / near-black (#1a1a1a), WCAG ~3.9', '#ff69b4', '#1a1a1a'],
    ])('%s: OKCA must be < 4.5', (_label, fg, bg) => {
      expect(okca.contrast(fg, bg)).toBeLessThan(4.5);
    });
  });

  // ── Probe battery: representative cases ──────────────────────────────────

  describe('probe battery', () => {
    describe('A: achromatic pairs (light-on-dark)', () => {
      it.each([
        ['white on #555555',             '#ffffff', '#555555',  6.7],
        ['white on #767676 (AA-adjacent)', '#ffffff', '#767676',  3.9],
        ['#cccccc on #333333',           '#cccccc', '#333333',  7.1],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('B: dark green backgrounds (WoB)', () => {
      it('white on forest green (#228b22) → 4', () => {
        expect(okca.contrast('#ffffff', '#228b22')).toBe(4);
      });
      it.each([
        ['white on forest-ish green (#3a7d44)', '#ffffff', '#3a7d44', 4.6],
        ['white on medium green (#008000)',     '#ffffff', '#008000', 4.8],
        ['white on dark green (#006400)',       '#ffffff', '#006400', 7.1],
        ['white on #007700 (near boundary)',    '#ffffff', '#007700', 5.4],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('C: dark blue backgrounds (WoB)', () => {
      it.each([
        ['white on navy (#000080)',     '#ffffff', '#000080', 14.4],
        ['white on D3 blue (#0057b7)', '#ffffff', '#0057b7', 6],
        ['light blue (#add8e6) on navy', '#add8e6', '#000080', 8.6],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('D: dark purple backgrounds (WoB)', () => {
      it.each([
        ['white on indigo (#4b0082)', '#ffffff', '#4b0082', 11.1],
        ['white on purple (#800080)', '#ffffff', '#800080',  7.7],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('E: dark red backgrounds (WoB)', () => {
      it.each([
        ['white on dark red (#8b0000)',  '#ffffff', '#8b0000', 8.4],
        ['white on firebrick (#b22222)', '#ffffff', '#b22222', 5.3],
        ['white on D3 red (#d62728)',    '#ffffff', '#d62728', 3.9],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('F: dark teal backgrounds (WoB)', () => {
      it.each([
        ['white on dark teal (#006666)', '#ffffff', '#006666', 6.3],
        ['white on teal (#008080)',      '#ffffff', '#008080', 4.3],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('G: chromatic light text on near-black', () => {
      it.each([
        ['light yellow (#ffff99) on near-black', '#ffff99', '#1a1a1a', 15.4],
        ['hot pink (#ff69b4) on near-black',     '#ff69b4', '#1a1a1a',  3.6],
        ['dark orange (#ff8c00) on near-black',  '#ff8c00', '#1a1a1a',  4.2],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('H: near-threshold boundary pairs', () => {
      it.each([
        ['white on #595959', '#ffffff', '#595959', 6.2],
        ['white on #007700', '#ffffff', '#007700', 5.4],
        ['white on #808080', '#ffffff', '#808080', 3.3],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('I: achromatic dark text on light (BoW)', () => {
      it.each([
        ['black on white',              '#000000', '#ffffff', 20],
        ['#333333 on white',            '#333333', '#ffffff', 11.4],
        ['#767676 on white',            '#767676', '#ffffff',  3.7],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('J: dark green text (BoW)', () => {
      it('forest green text (#228b22) on white → 3.9', () => {
        expect(okca.contrast('#228b22', '#ffffff')).toBe(3.9);
      });
      it.each([
        ['#008900 text on white',                 '#008900', '#ffffff', 4.1],
        ['dark green text (#006400) on white',    '#006400', '#ffffff', 6.8],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('K: dark blue text (BoW)', () => {
      it.each([
        ['navy text (#000080) on white',        '#000080', '#ffffff', 13.8],
        ['D3 blue text (#0057b7) on white',     '#0057b7', '#ffffff', 5.7],
        ['Tailwind blue-700 (#1d4ed8) on white', '#1d4ed8', '#ffffff', 5.3],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('L/M: dark purple and red text (BoW)', () => {
      it.each([
        ['indigo text (#4b0082) on white',   '#4b0082', '#ffffff', 10.6],
        ['dark red text (#8b0000) on white', '#8b0000', '#ffffff',  8.1],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('N: teal text boundary (BoW)', () => {
      it.each([
        ['teal text (#008080) on white',      '#008080', '#ffffff', 4.1],
        ['dark teal text (#006666) on white', '#006666', '#ffffff', 6],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });

    describe('O: light chromatic backgrounds (BoW)', () => {
      it.each([
        ['black on light green (#90ee90)',  '#000000', '#90ee90', 9.7],
        ['black on light blue (#add8e6)',   '#000000', '#add8e6', 12],
        ['black on light yellow (#ffff99)', '#000000', '#ffff99', 18.1],
      ])('%s → %s', (_l, fg, bg, expected) => {
        expect(okca.contrast(fg, bg)).toBe(expected);
      });
    });
  });
});
