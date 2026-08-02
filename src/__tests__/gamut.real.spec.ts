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
 * Reference colors and what each mapping method resolves them to. These are
 * assertions about two well-defined operations — chroma reduction and a channel
 * clamp — not about any renderer's behavior. klar takes no position on that.
 */
const MAPPED = [
  { authored: 'oklch(0.79 0.22 25)', clipped: '#ff746f', cssMapped: '#ff938b' },
  { authored: 'oklch(0.45 0.22 25)', clipped: '#b00000', cssMapped: '#a9000b' },
];

describe('gamut policy', () => {
  it('defaults to the CSS Color 4 mapping', () => {
    expect(DEFAULT_GAMUT_MODE).toBe('css');
    expect(GAMUT_MODES).toEqual(['clip', 'css', 'none']);
  });

  describe('clip clamps each channel into range', () => {
    it.each(MAPPED)('$authored → $clipped', ({ authored, clipped }) => {
      expect(clipToSrgb(new Color(authored)).to('srgb').toString({ format: 'hex' })).toBe(clipped);
    });
  });

  describe('css reduces chroma, and is a different operation from clip', () => {
    // The two must not be conflated: they resolve the same authored color to
    // different colors, and which one klar used to apply was an accident of
    // which helper a code path called (issue #9).
    it.each(MAPPED)('$authored → $cssMapped, not $clipped', ({ authored, cssMapped, clipped }) => {
      const mapped = cssMapToSrgb(new Color(authored)).to('srgb').toString({ format: 'hex' });
      expect(mapped).toBe(cssMapped);
      expect(mapped).not.toBe(clipped);
    });

    it('uses the spec algorithm, not plain chroma reduction', () => {
      // colorjs.io's `oklch.c` method gives #ff928a where the `css` method
      // gives #ff938b. The latter is what CSS Color 4 specifies and what klar
      // 2.x produced implicitly via hex serialization.
      for (const { authored } of MAPPED) {
        const legacy = new Color(authored).to('srgb').toString({ format: 'hex' });
        expect(cssMapToSrgb(new Color(authored)).to('srgb').toString({ format: 'hex' })).toBe(legacy);
      }
    });

    it('collapses every out-of-gamut chroma onto the same boundary color', () => {
      // Consequence worth pinning: measured contrast is flat across the whole
      // out-of-gamut range, so two different authored tokens produce an
      // identical number and only the out-of-gamut signal separates them.
      const a = cssMapToSrgb(new Color('oklch(0.79 0.22 25)')).to('srgb').toString({ format: 'hex' });
      const b = cssMapToSrgb(new Color('oklch(0.79 0.15 25)')).to('srgb').toString({ format: 'hex' });
      expect(a).toBe(b);
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

    it('matches the channel-clamped color under clip', () => {
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

  it('measures the mapped color, and says which one it measured', () => {
    // The number describes the color the input resolves to in the gamut, not
    // the authored coordinates. Scoring the mapped color directly must give the
    // same answer as measuring it by hand.
    const mapped = cssMapToSrgb(new Color(fg));
    const byHand = colorMetricsService.getContrast(
      `oklch(${numericCoords(mapped, 'oklch').join(' ')})`,
      bg,
      'okca',
    );
    expect(colorMetricsService.getContrast(fg, bg, 'okca')).toBe(byHand);
  });

  it('is not measuring the authored coordinates', () => {
    // The distinction the release exists to make visible: an out-of-gamut color
    // scores differently from the colorimetric value of what was written down,
    // which is why the case is signalled rather than passed through silently.
    const mapped = colorMetricsService.getContrast(fg, bg, 'okca')!;
    const authored = colorMetricsService.getContrast(fg, bg, 'wcag2', 'none')!;
    const mappedWcag = colorMetricsService.getContrast(fg, bg, 'wcag2')!;
    expect(mappedWcag).toBeLessThan(authored);
    expect(mapped).toBeGreaterThan(0);
  });

  it('applies one policy across every algorithm', () => {
    // `--type` used to change the gamut policy as well as the algorithm: wcag2
    // and deltaE scored raw unmapped coordinates while okca scored a
    // chroma-reduced color, with the error running in the permissive direction.
    for (const type of ['wcag2', 'deltaE']) {
      const dflt = colorMetricsService.getContrast(fg, bg, type)!;
      const css = colorMetricsService.getContrast(fg, bg, type, 'css')!;
      const authored = colorMetricsService.getContrast(fg, bg, type, 'none')!;

      expect(dflt).toBe(css);
      expect(css).toBeLessThan(authored);
    }
  });

  it('reports the same figure for every chroma above the gamut boundary', () => {
    // Two distinct authored tokens, one number. Only `outOfGamut` separates them.
    expect(colorMetricsService.getContrast('oklch(0.79 0.22 25)', bg, 'okca')).toBe(
      colorMetricsService.getContrast('oklch(0.79 0.15 25)', bg, 'okca'),
    );
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
    expect(colorSwatch(fg, 'css')).toContain('\x1b[38;2;255;147;139m');
    expect(colorSwatch(fg, 'clip')).toContain('\x1b[38;2;255;116;111m');
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
    // Routing through oklch() removes an 8-bit quantization step. These pairs
    // are hex-authored, so they already sit on the 8-bit grid and the round-trip
    // is lossless — the parity below is real but does not generalize. In-gamut
    // *OKLCH-authored* values do move, by exactly 0.1, on 47% of a real token
    // set. See the CHANGELOG; an earlier draft claimed this was a no-op for all
    // in-gamut colors, which a synthetic sweep supported and real data did not.
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
