import Color from 'colorjs.io';
import { OkcaService } from './okca.service';
import { PluginRegistry } from '@pawn002/klar-plugin-registry';
import {
  GamutMode,
  DEFAULT_GAMUT_MODE,
  applyGamut,
  cssMapToSrgb,
  toGamutHex,
  toGamutOklch,
  numericCoords,
} from './gamut';
import {
  ColorPair,
  ColorCoordArray,
  ChromaMatchObject,
  MinMaxLightObject,
  ColorMetaObj,
  TableColorCell,
  TableData,
  TargetContrastOptions,
  TargetContrastResult,
  FindAxis,
  FindReason,
} from './types';

export class ColorUtilService {
  constructor(
    private readonly okcaService: OkcaService,
    private readonly pluginRegistry?: PluginRegistry,
  ) {}

  parseColor(color: string): Color | null {
    try {
      return new Color(color);
    } catch {
      return null;
    }
  }

  createSrgbColor(color: string, lightness: number): string | null {
    const parsedColor = this.parseColor(color);
    if (!parsedColor) return null;

    const oklchColor = Color.to(parsedColor, 'oklch');
    const originalChroma = oklchColor.coords[1];
    const originalHue = oklchColor.coords[2];

    const targetColor = new Color('oklch', [lightness, originalChroma, originalHue]);
    const inGamut = targetColor.toGamut({ space: 'srgb', method: 'css' });
    return inGamut.to('srgb').toString({ format: 'hex' });
  }

  isInSrgbGamut(oklchColorCoord: ColorCoordArray): boolean {
    const colorObject = new Color('oklch', oklchColorCoord);
    return colorObject.inGamut('srgb');
  }

  createVariants(color: string): Array<ColorCoordArray> | null {
    const parsedColor = this.parseColor(color);
    if (!parsedColor) return null;

    const oklchColor = Color.to(parsedColor, 'oklch');
    const colorChroma = oklchColor.coords[1];
    const colorHue = oklchColor.coords[2];

    const lightnessSteps = 1000;
    const lightInterval = 1 / lightnessSteps;
    const variantCollection: Array<ColorCoordArray> = [];

    for (let i = 0; i <= lightnessSteps; i++) {
      variantCollection.push([i * lightInterval, colorChroma, colorHue]);
    }

    return variantCollection;
  }

  filterOutOfGamutVariants(variants: Array<ColorCoordArray> | null): Array<ColorCoordArray> {
    if (!variants) throw new Error('no variants');
    return variants.filter((v) => this.isInSrgbGamut(v));
  }

  getMinMaxLight(color: string): MinMaxLightObject | null {
    const parsedColor = this.parseColor(color);
    if (!parsedColor) return null;

    // `numericCoords` rather than `.coords`: colorjs.io hands back boxed Number
    // objects for bare-number CSS coordinates, and these are published in
    // `--json` where a consumer will compare them against real numbers.
    const originalCoords = numericCoords(parsedColor, 'oklch');
    const outOfGamut = !parsedColor.inGamut('srgb');

    const variants = this.filterOutOfGamutVariants(this.createVariants(color));

    if (variants.length) {
      return {
        originalCoords,
        lightMin: variants[0][0],
        lightMax: variants[variants.length - 1][0],
        outOfGamut,
      };
    }

    // No lightness renders at this chroma and hue. This used to return the
    // input's own lightness as both bounds, which reads as "the usable range is
    // exactly this one value" — a confident, specific, false answer to the
    // question the command exists to answer. There is no range; say so.
    return { originalCoords, lightMin: null, lightMax: null, outOfGamut };
  }

  getRandomColorPair(): ColorPair {
    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const targetChroma = rand(0.11, 0.34);
    const colorOne = new Color('oklch', [rand(0.25, 0.26), targetChroma, rand(0, 360)])
      .toGamut({ space: 'srgb', method: 'css' })
      .to('srgb')
      .toString({ format: 'hex' });
    const colorTwo = new Color('oklch', [rand(0.94, 0.95), targetChroma, rand(0, 360)])
      .toGamut({ space: 'srgb', method: 'css' })
      .to('srgb')
      .toString({ format: 'hex' });

    const initPair: ColorPair = [colorOne, colorTwo];
    const matched = this.matchChromas(initPair);
    return matched.colors ? matched.colors : initPair;
  }

  matchChromas(colorpair: ColorPair): ChromaMatchObject {
    let pair = new ChromaMatchObject();

    const colorOneParsed = this.parseColor(colorpair[0]);
    const colorTwoParsed = this.parseColor(colorpair[1]);

    if (!colorOneParsed || !colorTwoParsed) return pair;

    const c1Oklch = colorOneParsed.to('oklch');
    const c2Oklch = colorTwoParsed.to('oklch');
    const c1Chroma = c1Oklch.coords[1];
    const c2Chroma = c2Oklch.coords[1];

    const c1CandCoords: ColorCoordArray = [c1Oklch.coords[0], c2Chroma, c1Oklch.coords[2]];
    const c2CandCoords: ColorCoordArray = [c2Oklch.coords[0], c1Chroma, c2Oklch.coords[2]];

    const c1InGamut = this.isInSrgbGamut(c1CandCoords);
    const c2InGamut = this.isInSrgbGamut(c2CandCoords);

    if (c1InGamut && !c2InGamut) {
      pair.success = true;
      pair.colors = [
        new Color('oklch', c1CandCoords).to('srgb').toString({ format: 'hex' }),
        colorpair[1],
      ];
      pair.chroma = c1CandCoords[1];
    } else if (!c1InGamut && c2InGamut) {
      pair.success = true;
      pair.colors = [
        colorpair[0],
        new Color('oklch', c2CandCoords).to('srgb').toString({ format: 'hex' }),
      ];
      pair.chroma = c2CandCoords[1];
    } else if (c1InGamut && c2InGamut) {
      if (c1CandCoords[1] > c2CandCoords[1]) {
        pair.success = true;
        pair.colors = [
          new Color('oklch', c1CandCoords).to('srgb').toString({ format: 'hex' }),
          colorpair[1],
        ];
        // color1 was rebuilt at color2's chroma, and color2 is returned as-is,
        // so color2's chroma is the shared value. Reporting c2CandCoords[1]
        // here echoed color1's *original* chroma instead — 0 whenever color1
        // was neutral — while both returned colors carried c1CandCoords[1].
        pair.chroma = c1CandCoords[1];
      } else {
        pair.success = true;
        pair.colors = [
          colorpair[0],
          new Color('oklch', c2CandCoords).to('srgb').toString({ format: 'hex' }),
        ];
        pair.chroma = c2CandCoords[1];
      }
    }

    return pair;
  }

  calcDeltaE(colorOne: string, colorTwo: string, gamut: GamutMode = DEFAULT_GAMUT_MODE): number | null {
    const c1 = this.parseColor(colorOne);
    const c2 = this.parseColor(colorTwo);
    if (!c1 || !c2) return null;

    return Math.round(applyGamut(c1, gamut).deltaE2000(applyGamut(c2, gamut)));
  }

  calcWcag2(colorOne: string, colorTwo: string, gamut: GamutMode = DEFAULT_GAMUT_MODE): number | null {
    const c1 = this.parseColor(colorOne);
    const c2 = this.parseColor(colorTwo);
    if (!c1 || !c2) return null;

    return parseFloat(
      applyGamut(c1, gamut).contrast(applyGamut(c2, gamut), 'WCAG21').toFixed(1),
    );
  }

  getColorMeta(color: string): ColorMetaObj | null {
    const parsedColor = this.parseColor(color);
    if (!parsedColor) return null;

    const lchColor = Color.to(parsedColor, 'oklch');
    return {
      lightness: parseFloat(lchColor.coords[0].toFixed(2)),
      chroma: parseFloat(lchColor.coords[1].toFixed(2)),
      hue: parseFloat(lchColor.coords[2].toFixed(2)),
      saturation: parseFloat(((lchColor.coords[1] / lchColor.coords[0]) * 100).toFixed(2)),
    };
  }

  generateAllOklchVariants(
    color: string,
    lightSteps: number,
    chromaSteps: number,
    colorSpace: 'oklch' | 'hsl' = 'oklch',
  ): TableData {
    const parsedColor = this.parseColor(color);
    if (!parsedColor) throw new Error(`Could not parse color: ${color}`);

    const variantsCollection: TableData = [];

    if (colorSpace === 'hsl') {
      const baseHsl = parsedColor.to('hsl');
      const hue = baseHsl.coords[0];

      for (let s = 0; s <= chromaSteps; s++) {
        const saturationPercent = (s / chromaSteps) * 100;
        const row: Array<TableColorCell> = [];

        for (let l = 0; l <= lightSteps; l++) {
          const lightnessPercent = (l / lightSteps) * 100;
          const variantColor = new Color('hsl', [hue, saturationPercent, lightnessPercent]);
          const inGamut = variantColor.inGamut('srgb');
          const colorVal = inGamut ? variantColor.to('srgb').toString({ format: 'hex' }) : '';
          const deltaE = colorVal ? this.calcDeltaE(colorVal, color) : null;
          const oklch = variantColor.to('oklch');
          const baseOklch = parsedColor.to('oklch');

          const dLight = colorVal
            ? Math.round(((oklch.coords[0] - baseOklch.coords[0]) / baseOklch.coords[0]) * 100)
            : null;
          const dChroma = colorVal
            ? Math.round(((oklch.coords[1] - baseOklch.coords[1]) / baseOklch.coords[1]) * 100)
            : null;

          row.push({
            color: colorVal,
            lightness: oklch.coords[0],
            chroma: oklch.coords[1],
            hue: oklch.coords[2],
            deltaE: deltaE ?? NaN,
            deltaChroma: dChroma ?? NaN,
            deltaLightness: dLight ?? NaN,
          });
        }
        variantsCollection.push(row);
      }
      return variantsCollection.reverse();
    }

    // OKLCH variant generation
    const oklchColor = Color.to(parsedColor, 'oklch');
    const colorLight = oklchColor.coords[0];
    const colorChroma = oklchColor.coords[1];
    const colorHue = oklchColor.coords[2];

    const lightInterval = 1 / lightSteps;
    const rawLightLevels: number[] = [];

    let lLevel = colorLight;
    do { rawLightLevels.push(lLevel); lLevel += lightInterval; } while (lLevel <= 1);
    lLevel = colorLight;
    do { rawLightLevels.push(lLevel); lLevel -= lightInterval; } while (lLevel >= 0);

    const sortedLightLevels = [...new Set(rawLightLevels)].sort((a, b) => a - b);

    const chromaInterval = 0.33 / chromaSteps;
    const rawChromaLevels: number[] = [];

    let cLevel = colorChroma;
    do { rawChromaLevels.push(cLevel); cLevel += chromaInterval; } while (cLevel <= 0.33);
    cLevel = colorChroma;
    do { rawChromaLevels.push(cLevel); cLevel -= chromaInterval; } while (cLevel >= 0);

    const sortedChromaLevels = [...new Set(rawChromaLevels)].sort((a, b) => a - b);

    for (const targetLightness of sortedLightLevels) {
      const row: Array<TableColorCell> = [];

      for (const targetChroma of sortedChromaLevels) {
        const variantColor = new Color('oklch', [targetLightness, targetChroma, colorHue]);
        const inGamut = variantColor.inGamut('srgb');
        const colorVal = inGamut ? variantColor.to('srgb').toString({ format: 'hex' }) : '';
        const deltaE = colorVal ? this.calcDeltaE(colorVal, color) : null;
        const dLight = colorVal ? Math.round(((targetLightness - colorLight) / colorLight) * 100) : null;
        const dChroma = colorVal ? Math.round(((targetChroma - colorChroma) / colorChroma) * 100) : null;

        row.push({
          color: colorVal,
          lightness: targetLightness,
          chroma: targetChroma,
          hue: colorHue,
          deltaE: deltaE ?? NaN,
          deltaChroma: dChroma ?? NaN,
          deltaLightness: dLight ?? NaN,
        });
      }
      variantsCollection.push(row);
    }

    return variantsCollection.reverse();
  }

  /**
   * Generate a variant grid where every adjacent cell differs by at least
   * `minDelta` Delta E 2000 from its neighbors on both the lightness and
   * chroma axes.  The grid self-sizes based on the color's sRGB gamut
   * boundaries — no fixed step counts.
   *
   * Algorithm:
   *  1. Walk chroma outward from the base color at the base lightness.
   *     Accept a new chroma level only when deltaE >= minDelta from the
   *     previously accepted level.
   *  2. At each accepted chroma, walk lightness outward from the base
   *     independently — so each chroma column explores the full gamut
   *     range available at that chroma.
   *  3. Only in-gamut (sRGB) cells are emitted.
   *  4. Columns (chroma walks) are assembled into rows (by index)
   *     to produce a jagged table ordered light-to-dark.
   */
  generateAdaptiveVariants(
    color: string,
    minDelta: number = 11,
  ): TableData {
    const parsedColor = this.parseColor(color);
    if (!parsedColor) throw new Error(`Could not parse color: ${color}`);

    const oklch = Color.to(parsedColor, 'oklch');
    const baseL = oklch.coords[0];
    const baseC = oklch.coords[1];
    const baseH = oklch.coords[2];

    const L_STEP = 0.005;
    const C_STEP = 0.005;

    // --- Build accepted chroma levels (once, at base lightness) ---
    const chromaLevels = this.walkAxis(
      baseL, baseC, baseH, minDelta, C_STEP,
      0, 0.4, 'chroma',
    );

    // --- At each chroma, build accepted lightness levels independently ---
    const columns: TableColorCell[][] = [];

    for (const targetC of chromaLevels) {
      const lightnessLevels = this.walkAxis(
        baseL, targetC, baseH, minDelta, L_STEP,
        0, 1, 'lightness',
      );

      const col: TableColorCell[] = [];
      for (const targetL of lightnessLevels) {
        const variant = new Color('oklch', [targetL, targetC, baseH]);
        if (!variant.inGamut('srgb')) continue;

        const hex = variant.to('srgb').toString({ format: 'hex' });
        const deltaE = this.calcDeltaE(hex, color) ?? NaN;
        const dLight = baseL !== 0
          ? Math.round(((targetL - baseL) / baseL) * 100)
          : NaN;
        const dChroma = baseC !== 0
          ? Math.round(((targetC - baseC) / baseC) * 100)
          : NaN;

        col.push({
          color: hex,
          lightness: targetL,
          chroma: targetC,
          hue: baseH,
          deltaE,
          deltaChroma: dChroma,
          deltaLightness: dLight,
        });
      }

      if (col.length > 0) {
        columns.push(col);
      }
    }

    // --- Sort each column light-to-dark (descending lightness) ---
    for (const col of columns) {
      col.sort((a, b) => b.lightness - a.lightness);
    }

    // --- Transpose columns into rows by index ---
    // Row r = the r-th cell from each column that has at least r+1 cells.
    // This keeps each visual column at constant chroma with lightness
    // decreasing top-to-bottom.
    const maxHeight = Math.max(...columns.map((c) => c.length));
    const grid: TableData = [];
    for (let r = 0; r < maxHeight; r++) {
      const row: TableColorCell[] = [];
      for (const col of columns) {
        if (r < col.length) {
          row.push(col[r]);
        }
      }
      if (row.length > 0) {
        grid.push(row);
      }
    }

    return grid;
  }

  /**
   * Walk an OKLCH axis outward from a base value in both directions,
   * accepting positions only when they are >= minDelta from the
   * previously accepted position.
   */
  private walkAxis(
    baseL: number,
    baseC: number,
    baseH: number,
    minDelta: number,
    step: number,
    min: number,
    max: number,
    axis: 'lightness' | 'chroma',
  ): number[] {
    const makeHex = (l: number, c: number): string | null => {
      const col = new Color('oklch', [l, c, baseH]);
      if (!col.inGamut('srgb')) return null;
      return col.to('srgb').toString({ format: 'hex' });
    };

    const getLVal = (pos: number): number =>
      axis === 'lightness' ? pos : baseL;
    const getCVal = (pos: number): number =>
      axis === 'chroma' ? pos : baseC;

    const baseVal = axis === 'lightness' ? baseL : baseC;
    const accepted: number[] = [baseVal];

    // Walk upward
    let prevHex = makeHex(getLVal(baseVal), getCVal(baseVal));
    let pos = baseVal + step;
    while (pos <= max) {
      const hex = makeHex(getLVal(pos), getCVal(pos));
      if (hex && prevHex) {
        const de = this.calcDeltaE(hex, prevHex);
        if (de !== null && de >= minDelta) {
          accepted.push(pos);
          prevHex = hex;
        }
      } else if (hex && !prevHex) {
        // Re-entered gamut
        prevHex = hex;
      } else if (!hex && prevHex) {
        // Left gamut, stop
        break;
      }
      pos += step;
    }

    // Walk downward
    prevHex = makeHex(getLVal(baseVal), getCVal(baseVal));
    pos = baseVal - step;
    while (pos >= min) {
      const hex = makeHex(getLVal(pos), getCVal(pos));
      if (hex && prevHex) {
        const de = this.calcDeltaE(hex, prevHex);
        if (de !== null && de >= minDelta) {
          accepted.unshift(pos);
          prevHex = hex;
        }
      } else if (hex && !prevHex) {
        prevHex = hex;
      } else if (!hex && prevHex) {
        break;
      }
      pos -= step;
    }

    return accepted;
  }

  /**
   * Hex under a gamut policy. This previously delegated straight to colorjs.io
   * serialization, which silently applied CSS Color 4 chroma reduction — see
   * the note at the top of `gamut.ts`.
   */
  toHex(color: Color, gamut: GamutMode = DEFAULT_GAMUT_MODE): string {
    return toGamutHex(color, gamut);
  }

  toOKLCH(color: Color): { l: number; c: number; h: number } {
    const oklch = color.to('oklch');
    return { l: oklch.coords[0], c: oklch.coords[1], h: oklch.coords[2] };
  }

  fromOKLCH(l: number, c: number, h: number): Color {
    return new Color('oklch', [l, c, h]);
  }

  private calculateContrastByType(
    colorOne: string,
    colorTwo: string,
    contrastType: string,
    gamut: GamutMode = DEFAULT_GAMUT_MODE,
  ): number | null {
    const c1 = this.parseColor(colorOne);
    const c2 = this.parseColor(colorTwo);
    if (!c1 || !c2) return null;

    switch (contrastType) {
      case 'deltaE':
        return this.calcDeltaE(colorOne, colorTwo, gamut);
      case 'wcag2':
        return this.calcWcag2(colorOne, colorTwo, gamut);
      case 'okca':
        return this.okcaService.contrast(toGamutOklch(c1, gamut), toGamutOklch(c2, gamut));
      default: {
        const h1 = this.toHex(c1, gamut);
        const h2 = this.toHex(c2, gamut);
        return this.pluginRegistry?.get(contrastType)?.calculate(h1, h2) ?? null;
      }
    }
  }

  /**
   * Binary-search lightness at a fixed chroma and hue for a color meeting the
   * target. Candidates outside the gamut are skipped, so a chroma that only
   * renders across part of the lightness range still searches the part it does.
   */
  private searchLightness(params: {
    baseColor: string;
    baseLightness: number;
    anchorLightness: number;
    chroma: number;
    hue: number;
    targetContrast: number;
    contrastType: string;
    tolerance: number;
    gamut: GamutMode;
  }): {
    best: { hex: string; contrast: number; l: number } | null;
    bestAchievable: { hex: string; contrast: number; l: number } | null;
    iterations: number;
  } {
    const { baseColor, baseLightness, anchorLightness, chroma, hue } = params;
    const { targetContrast, contrastType, tolerance, gamut } = params;

    let low = 0;
    let high = 1;
    let iterations = 0;
    const maxIterations = 20;

    // The target is a floor, so a result only counts when it reaches or exceeds
    // it. `best` is the satisfying candidate with the least overshoot; the
    // tolerance is the band *above* the target within which we stop early.
    let best: { hex: string; contrast: number; l: number } | null = null;
    let bestAchievable: { hex: string; contrast: number; l: number } | null = null;

    // Evaluate the anchor before bisecting.
    //
    // A bisection over [0,1] can converge without ever testing the reference's
    // own lightness, and for a saturated hue that is often the *only* place the
    // chroma renders at all — every midpoint falls outside the gamut and gets
    // skipped. The result was `find` reporting a target unreachable while the
    // unmodified reference already met it. It is also the semantically obvious
    // first candidate: if the color as given already clears the floor, nothing
    // needs to move.
    const anchor = new Color('oklch', [anchorLightness, chroma, hue]);
    if (anchor.inGamut('srgb')) {
      const anchorHex = anchor.to('srgb').toString({ format: 'hex' });
      const anchorContrast = this.calculateContrastByType(anchorHex, baseColor, contrastType, gamut);
      if (anchorContrast !== null) {
        const abs = Math.abs(anchorContrast);
        bestAchievable = { hex: anchorHex, contrast: anchorContrast, l: anchorLightness };
        if (abs >= targetContrast) {
          best = { hex: anchorHex, contrast: anchorContrast, l: anchorLightness };
          // Already within the stop band — the reference needs no adjustment.
          if (abs - targetContrast <= tolerance) {
            return { best, bestAchievable, iterations: 1 };
          }
        }
      }
    }

    while (iterations < maxIterations && high - low > 0.001) {
      const mid = (low + high) / 2;
      const testColor = new Color('oklch', [mid, chroma, hue]);

      if (!testColor.inGamut('srgb')) {
        if (mid > anchorLightness) high = mid;
        else low = mid;
        iterations++;
        continue;
      }

      const testColorHex = testColor.to('srgb').toString({ format: 'hex' });
      const contrast = this.calculateContrastByType(testColorHex, baseColor, contrastType, gamut);
      iterations++;

      if (contrast === null) continue;
      const absContrast = Math.abs(contrast);

      if (!bestAchievable || absContrast > Math.abs(bestAchievable.contrast)) {
        bestAchievable = { hex: testColorHex, contrast, l: mid };
      }

      if (absContrast >= targetContrast) {
        if (!best || absContrast < Math.abs(best.contrast)) {
          best = { hex: testColorHex, contrast, l: mid };
        }
        if (absContrast - targetContrast <= tolerance) break;
        if (baseLightness > 0.5) low = mid;
        else high = mid;
      } else {
        if (baseLightness > 0.5) high = mid;
        else low = mid;
      }
    }

    return { best, bestAchievable, iterations };
  }

  /**
   * The least desaturation that reaches the target at a fixed lightness and hue.
   *
   * Walks chroma downward from `maxChroma` and returns the first value that
   * meets the target, which is the largest — i.e. the smallest sacrifice of
   * saturation that works. A stepped walk rather than a bisection because
   * contrast is not guaranteed monotonic in chroma for every hue and base, and
   * the range is small enough that robustness is worth more than speed.
   */
  private searchChroma(params: {
    baseColor: string;
    lightness: number;
    hue: number;
    maxChroma: number;
    targetContrast: number;
    contrastType: string;
    gamut: GamutMode;
  }): { chroma: number; contrast: number; hex: string } | null {
    const { baseColor, lightness, hue, maxChroma, targetContrast, contrastType, gamut } = params;
    const STEP = 0.002;

    for (let c = maxChroma; c >= -STEP; c -= STEP) {
      const chroma = Math.max(0, c);
      const candidate = new Color('oklch', [lightness, chroma, hue]);
      if (!candidate.inGamut('srgb')) continue;

      const hex = candidate.to('srgb').toString({ format: 'hex' });
      const contrast = this.calculateContrastByType(hex, baseColor, contrastType, gamut);
      if (contrast !== null && Math.abs(contrast) >= targetContrast) {
        return { chroma, contrast, hex };
      }
      if (chroma === 0) break;
    }
    return null;
  }

  /**
   * The highest contrast any color can reach against this base.
   *
   * Maximum contrast is always against black or white, so this bounds the whole
   * color space. It is what separates "not reachable under your constraints"
   * from "not reachable at all", which are different facts an agent has to act
   * on differently — the first is solved by relaxing a constraint, the second
   * only by changing the base color.
   */
  private contrastCeiling(baseColor: string, contrastType: string, gamut: GamutMode): number {
    const black = this.calculateContrastByType('#000000', baseColor, contrastType, gamut) ?? 0;
    const white = this.calculateContrastByType('#ffffff', baseColor, contrastType, gamut) ?? 0;
    return Math.max(Math.abs(black), Math.abs(white));
  }

  /**
   * Find a color meeting a target contrast against a fixed base.
   *
   * Two chroma operations are involved and only one is optional:
   *
   *  1. **Gamut normalization is mandatory.** An out-of-gamut reference is
   *     chroma-reduced onto the gamut boundary before anything else. Without it
   *     there is no renderable color to return — this is the difference between
   *     an answer and nothing, not a choice. It also makes "returns the input
   *     unchanged" structurally impossible, which was the defect in klar 2.x.
   *  2. **Target-reaching desaturation is optional and off by default.** Once
   *     the color is renderable, only lightness moves. Trading brand saturation
   *     for contrast is a design decision, so when lightness runs out `find`
   *     reports what *would* work (`resolvableBy`) and exits 1 rather than
   *     applying it.
   *
   * Producing commands always use the standard mapping — there is no gamut
   * option here, because every place one could apply is either structural or a
   * no-op on candidates that are in-gamut by construction.
   */
  findColorForTargetContrast(options: TargetContrastOptions): TargetContrastResult {
    const {
      baseColor,
      referenceColor,
      targetContrast,
      contrastType,
      tolerance = 0.5,
      allowDesaturation = false,
    } = options;

    const gamut: GamutMode = 'css';

    const refColorObj = this.parseColor(referenceColor);
    if (!refColorObj) throw new Error('Invalid reference color');
    const baseColorObj = this.parseColor(baseColor);
    if (!baseColorObj) throw new Error('Invalid base color');

    const [originalLightness] = numericCoords(refColorObj, 'oklch');
    const outOfGamut = !refColorObj.inGamut('srgb');

    // --- Step 1: mandatory gamut normalization -----------------------------
    const normalized = outOfGamut ? cssMapToSrgb(refColorObj) : refColorObj;
    const [normalizedLightness, workingChroma, rawHue] = numericCoords(normalized, 'oklch');
    const hue = Number.isFinite(rawHue) ? rawHue : 0;
    const normalizedHex = normalized.to('srgb').toString({ format: 'hex' });
    const gamutReport = outOfGamut
      ? { outOfGamut: true, measured: normalizedHex }
      : { outOfGamut: false };

    const baseLightness = numericCoords(baseColorObj, 'oklch')[0];
    const driftFrom = (hex: string) => this.calcDeltaE(hex, referenceColor, gamut);

    // --- Step 2: lightness, at the normalized chroma ------------------------
    const pass = this.searchLightness({
      baseColor,
      baseLightness,
      // The normalized lightness, not the authored one: gamut mapping can shift
      // L, and this anchor has to be a point where `workingChroma` renders.
      anchorLightness: normalizedLightness,
      chroma: workingChroma,
      hue,
      targetContrast,
      contrastType,
      tolerance,
      gamut,
    });

    if (pass.best) {
      // Movement is measured from the normalized color: gamut normalization is
      // reported under `gamut`, not as an axis the caller asked to move.
      const axes: FindAxis[] =
        Math.abs(pass.best.l - normalizedLightness) > 1e-6 ? ['lightness'] : [];
      return {
        adjustedColor: pass.best.hex,
        actualContrast: pass.best.contrast,
        iterations: pass.iterations,
        success: true,
        reason: 'ok',
        axesAdjusted: axes,
        deltaE: driftFrom(pass.best.hex),
        oklch: { l: pass.best.l, c: workingChroma, h: hue },
        gamut: gamutReport,
      };
    }

    // --- Step 3: what would chroma do, at the *original* lightness? ---------
    // Quoted against the lightness the author chose, not the one the search
    // drifted to — "keep your lightness, drop chroma to X" is actionable in a
    // way a figure against an unfamiliar lightness is not. `--allow-desaturation`
    // searches from the same starting point so the two agree on the cost.
    const viaChroma = this.searchChroma({
      baseColor,
      lightness: originalLightness,
      hue,
      maxChroma: workingChroma,
      targetContrast,
      contrastType,
      gamut,
    });

    if (allowDesaturation && viaChroma) {
      const axes: FindAxis[] = ['chroma'];
      return {
        adjustedColor: viaChroma.hex,
        actualContrast: viaChroma.contrast,
        iterations: pass.iterations,
        success: true,
        reason: 'ok',
        axesAdjusted: axes,
        deltaE: driftFrom(viaChroma.hex),
        oklch: { l: originalLightness, c: viaChroma.chroma, h: hue },
        gamut: gamutReport,
      };
    }

    // --- Failure. Say which constraint bound the search. --------------------
    const ceiling = this.contrastCeiling(baseColor, contrastType, gamut);
    const reason: FindReason =
      targetContrast > ceiling
        ? 'unreachable'
        : allowDesaturation
          ? 'chroma-exhausted'
          : 'lightness-exhausted';

    // Always renderable: normalization ran before the search, so the worst case
    // is the normalized reference rather than an unusable input echoed back.
    const fallback = pass.bestAchievable ?? {
      hex: normalizedHex,
      contrast: this.calculateContrastByType(normalizedHex, baseColor, contrastType, gamut) ?? 0,
      l: originalLightness,
    };

    const message =
      reason === 'unreachable'
        ? `Target contrast ${targetContrast} exceeds the maximum reachable against ` +
          `${baseColor} (${ceiling.toFixed(1)}, at black or white). No color meets it; ` +
          `the base color has to change.`
        : reason === 'chroma-exhausted'
          ? `Target contrast ${targetContrast} not reached even at chroma 0 ` +
            `(closest: ${Math.abs(fallback.contrast)}).`
          : `Target contrast ${targetContrast} not reachable by lightness alone ` +
            `(closest: ${Math.abs(fallback.contrast)}).` +
            (viaChroma
              ? ` Reducing chroma to ${viaChroma.chroma.toFixed(3)} would reach it — ` +
                `pass --allow-desaturation to apply that.`
              : ` Chroma reduction at this lightness does not reach it either ` +
                `(the target is below what this base allows, so a combination of ` +
                `lower chroma and a different lightness may exist — klar moves one ` +
                `axis at a time and will not find it).`);

    return {
      adjustedColor: fallback.hex,
      actualContrast: fallback.contrast,
      iterations: pass.iterations,
      success: false,
      reason,
      axesAdjusted: [],
      deltaE: driftFrom(fallback.hex),
      ...(reason === 'lightness-exhausted' && viaChroma
        ? { resolvableBy: { chroma: viaChroma.chroma, deltaE: driftFrom(viaChroma.hex) } }
        : {}),
      message,
      oklch: { l: fallback.l, c: workingChroma, h: hue },
      gamut: gamutReport,
    };
  }
}
