import Color from 'colorjs.io';
import { OkcaService } from '@pawn002/okca';
import {
  GAMUT_MODES,
  DEFAULT_GAMUT_MODE,
  AlgorithmDomainError,
  isInSrgbGamut,
  clipToSrgb,
  cssMapToSrgb,
  applyGamut,
  toGamutHex,
  toGamutOklch,
  numericCoords,
  toRgb255,
  describeGamut,
} from '../services/gamut';
import { getServices } from '../services';
import { colorSwatch } from '../formatters/human';

/**
 * Reference values sampled from Chrome 150 on sRGB output, cross-checked
 * against canvas `getImageData` and composited-pixel screenshots (issue #9).
 * These pin the behavior that matters: what a display actually paints.
 */
const PAINTED = [
  { authored: 'oklch(0.79 0.22 25)', painted: '#ff746f', cssMapped: '#ff938b' },
  { authored: 'oklch(0.45 0.22 25)', painted: '#b00000', cssMapped: '#a9000b' },
];

describe('gamut policy', () => {
  it('defaults to clip — what a display paints', () => {
    expect(DEFAULT_GAMUT_MODE).toBe('clip');
    expect(GAMUT_MODES).toEqual(['clip', 'css', 'none']);
  });

  describe('clip matches what browsers paint', () => {
    it.each(PAINTED)('$authored → $painted', ({ authored, painted }) => {
      expect(clipToSrgb(new Color(authored)).to('srgb').toString({ format: 'hex' })).toBe(painted);
    });
  });

  describe('css mapping is the CSS Color 4 algorithm, and differs from clip', () => {
    // Guards the trap recorded in issue #9: the spec algorithm is *not* what
    // browsers do today, so reaching for it produces a different set of wrong
    // numbers with more authority behind them.
    it.each(PAINTED)('$authored → $cssMapped, not $painted', ({ authored, cssMapped, painted }) => {
      const mapped = cssMapToSrgb(new Color(authored)).to('srgb').toString({ format: 'hex' });
      expect(mapped).toBe(cssMapped);
      expect(mapped).not.toBe(painted);
    });

    it('reproduces klar 2.x hex serialization exactly', () => {
      // `--gamut css` exists to reproduce 2.x figures; a near-miss (the
      // `oklch.c` method gives #ff928a here) would defeat its only purpose.
      for (const { authored } of PAINTED) {
        const legacy = new Color(authored).to('srgb').toString({ format: 'hex' });
        expect(cssMapToSrgb(new Color(authored)).to('srgb').toString({ format: 'hex' })).toBe(legacy);
      }
    });
  });

  describe('none', () => {
    it('leaves the authored color untouched', () => {
      const c = new Color('oklch(0.79 0.22 25)');
      expect(isInSrgbGamut(applyGamut(c, 'none'))).toBe(false);
      expect(applyGamut(c, 'none').to('srgb').coords[0]).toBeGreaterThan(1);
    });

    it('refuses to resolve to hex rather than silently mapping', () => {
      expect(() => toGamutHex(new Color('oklch(0.79 0.22 25)'), 'none')).toThrow(
        AlgorithmDomainError,
      );
    });
  });

  it('leaves in-gamut colors alone under every mode', () => {
    for (const mode of GAMUT_MODES) {
      expect(applyGamut(new Color('#070e16'), mode).to('srgb').toString({ format: 'hex' })).toBe(
        '#070e16',
      );
    }
  });

  describe('toRgb255', () => {
    it('clamps out-of-gamut coordinates into 0–255', () => {
      for (const mode of GAMUT_MODES) {
        for (const c of toRgb255(new Color('oklch(0.79 0.22 25)'), mode)) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(255);
        }
      }
    });

    it('matches the painted color under clip', () => {
      expect(toRgb255(new Color('oklch(0.79 0.22 25)'), 'clip')).toEqual([255, 116, 111]);
    });
  });

  describe('describeGamut', () => {
    it('flags out-of-gamut input and reports the measured color', () => {
      expect(describeGamut(new Color('oklch(0.79 0.22 25)'), 'clip')).toEqual({
        outOfGamut: true,
        measured: '#ff746f',
      });
    });

    it('reports in-gamut input as such', () => {
      expect(describeGamut(new Color('#070e16'), 'clip')).toEqual({
        outOfGamut: false,
        measured: '#070e16',
      });
    });
  });
});

describe('contrast is gamut-aware (issue #9)', () => {
  const { colorMetricsService } = getServices();
  const fg = 'oklch(0.79 0.22 25)';
  const bg = '#070e16';

  it('measures what a display paints, not a color nobody sees', () => {
    // The regression: 2.x reported 6.1 here — the contrast of #ff938b, which
    // is neither the authored color nor what Chrome paints. On a pair whose
    // floor is 4.5 that read as a comfortable pass and renders as a clear fail.
    const painted = colorMetricsService.getContrast('#ff746f', bg, 'okca');
    expect(colorMetricsService.getContrast(fg, bg, 'okca')).toBe(painted);
  });

  it('does not report the old optimistic figure by default', () => {
    const now = colorMetricsService.getContrast(fg, bg, 'okca')!;
    const legacy = colorMetricsService.getContrast(fg, bg, 'okca', 'css')!;
    expect(now).toBeLessThan(legacy);
    expect(now).toBeLessThan(4.5);
    expect(legacy).toBeGreaterThan(4.5);
  });

  it('applies the policy to every algorithm, not just okca', () => {
    // `--type` used to change the gamut policy as well as the algorithm:
    // wcag2 and deltaE scored raw unclipped coordinates, with the error running
    // in the same permissive direction (9.2 reported where the painted color
    // measures 7.4).
    for (const type of ['wcag2', 'deltaE']) {
      const clipped = colorMetricsService.getContrast(fg, bg, type, 'clip')!;
      const authored = colorMetricsService.getContrast(fg, bg, type, 'none')!;
      const painted = colorMetricsService.getContrast('#ff746f', bg, type)!;

      expect(colorMetricsService.getContrast(fg, bg, type)).toBe(clipped);
      expect(clipped).toBeLessThan(authored);
      // `clip` is a gamut operation only — it clamps channels but keeps float
      // precision, while `#ff746f` has been quantized to 8 bits. They agree to
      // within that rounding, which is the whole remaining gap.
      expect(clipped).toBeCloseTo(painted, 0);
    }
  });

  it('keeps in-gamut results identical across modes', () => {
    for (const type of ['okca', 'wcag2', 'deltaE']) {
      const clip = colorMetricsService.getContrast('#ffffff', '#000000', type, 'clip');
      const css = colorMetricsService.getContrast('#ffffff', '#000000', type, 'css');
      expect(clip).toBe(css);
    }
  });

  it('refuses rather than answering outside the algorithm\'s proven domain', () => {
    // Not a representation limit — okca accepts `oklch()` and would return a
    // number. Its guarantee is established across the sRGB gamut, so outside it
    // the answer would be unvalidated extrapolation.
    expect(() => colorMetricsService.getContrast(fg, bg, 'okca', 'none')).toThrow(
      AlgorithmDomainError,
    );
  });

  it('renders the swatch for the color it measured', () => {
    // A single line of output must not show one color and report a number
    // computed on another.
    expect(colorSwatch(fg, 'clip')).toContain('\x1b[38;2;255;116;111m');
    expect(colorSwatch(fg, 'css')).toContain('\x1b[38;2;255;147;139m');
  });
});

describe('okca is scored via oklch() at full precision', () => {
  const okca = new OkcaService();
  const { colorMetricsService } = getServices();

  describe('achromatic colors', () => {
    // The landmine. Converting a gray to OKLCH yields a NaN hue and a chroma
    // like 6.2e-16 — the first makes okca return null, the second serializes to
    // exponent notation that is not valid CSS. Neutrals are the most common
    // color in a design system, so this would have been most of a token set,
    // failing silently as `null` rather than as an error.
    const GRAYS = ['#000000', '#767676', '#888888', '#cccccc', '#ffffff'];

    it.each(GRAYS)('%s serializes to parseable oklch()', (gray) => {
      const str = toGamutOklch(new Color(gray), 'clip');
      expect(str).not.toContain('NaN');
      expect(str).not.toMatch(/e[+-]\d+/);
      expect(okca.contrast(str, '#ffffff')).not.toBeNull();
    });

    it.each(GRAYS)('%s returns a contrast, not null', (gray) => {
      expect(colorMetricsService.getContrast(gray, '#ffffff', 'okca')).not.toBeNull();
    });
  });

  describe('parity with the hex route it replaces', () => {
    // Routing through oklch() removes an 8-bit quantization step. A 4000-pair
    // random sweep found zero differences at okca's reported precision, so this
    // is a no-op for in-gamut colors — it closes the gap with the continuous
    // algorithms without moving any existing number.
    const PAIRS: Array<[string, string]> = [
      ['#ff746f', '#070e16'],
      ['#3b82f6', '#070e16'],
      ['#e94560', '#070e16'],
      ['#ffffff', '#000000'],
      ['#767676', '#ffffff'],
      ['#1a1a2e', '#e94560'],
    ];

    it.each(PAIRS)('%s on %s matches the hex route', (fg, bg) => {
      const viaHex = okca.contrast(fg, bg);
      const viaOklch = okca.contrast(
        toGamutOklch(new Color(fg), 'clip'),
        toGamutOklch(new Color(bg), 'clip'),
      );
      expect(viaOklch).toBe(viaHex);
    });
  });

  it('still refuses an unmapped out-of-gamut color', () => {
    expect(() => toGamutOklch(new Color('oklch(0.79 0.22 25)'), 'none')).toThrow(
      AlgorithmDomainError,
    );
  });
});

describe('boxed coordinates from colorjs.io', () => {
  // colorjs.io returns boxed Number objects for bare-number CSS coordinates.
  // They coerce correctly under arithmetic, comparison, toFixed and
  // JSON.stringify — but not under Number.isFinite, strict equality, or typeof.
  // A guard written the obvious way misfires on exactly the input klar exists
  // to handle.
  it('is a real hazard, not a hypothetical one', () => {
    const raw = new Color('oklch(0.45 0.22 25)').to('oklch').coords[1];
    expect(typeof raw).toBe('object');
    expect(Number.isFinite(raw)).toBe(false);
    expect(Number(raw)).toBe(0.22);
  });

  it('does not survive numericCoords', () => {
    const coords = numericCoords(new Color('oklch(0.45 0.22 25)'), 'oklch');
    for (const c of coords) {
      expect(typeof c).toBe('number');
      expect(Number.isFinite(c)).toBe(true);
    }
    expect(coords[1]).toBe(0.22);
  });

  it('does not zero out a valid chroma in toGamutOklch', () => {
    // The failure this guards: `Number.isFinite(boxed)` is false, so the
    // "chroma is conversion noise" branch would fire on a fully saturated color
    // and okca would score every oklch-string input as achromatic.
    for (const mode of ['clip', 'css'] as const) {
      const str = toGamutOklch(new Color('oklch(0.6 0.15 260)'), mode);
      const chroma = Number(str.match(/oklch\(\S+ (\S+)/)![1]);
      expect(chroma).toBeGreaterThan(0.01);
    }
  });

  it('publishes primitive numbers in the lightness payload', () => {
    const { colorUtilService } = getServices();
    for (const c of colorUtilService.getMinMaxLight('oklch(0.45 0.22 25)')!.originalCoords) {
      expect(typeof c).toBe('number');
    }
  });
});
