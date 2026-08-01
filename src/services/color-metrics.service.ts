import Color from 'colorjs.io';
import { ContrastType } from './types';
import { ColorUtilService } from './color-util.service';
import { OkcaService } from './okca.service';
import { PluginRegistry } from '@pawn002/klar-plugin-registry';
import { GamutMode, DEFAULT_GAMUT_MODE, applyGamut, toGamutHex } from './gamut';

export class ColorMetricsService {
  constructor(
    private readonly colorUtilService: ColorUtilService,
    private readonly okcaService: OkcaService,
    private readonly pluginRegistry?: PluginRegistry,
  ) {}

  /**
   * Contrast between two colors under an explicit gamut policy.
   *
   * The policy is applied here, at the input boundary, rather than inside each
   * algorithm. Previously each branch resolved colors its own way: okca and
   * plugins went through hex serialization (CSS chroma reduction), while wcag2
   * and deltaE scored the authored coordinates with no mapping at all. So
   * `--type` silently changed the gamut policy as well as the algorithm, and
   * both defaults erred in the permissive direction on out-of-gamut input.
   *
   * @throws GamutNotRepresentableError when `gamut: 'none'` meets an algorithm
   * that takes hex. Callers at the CLI boundary turn this into a usage error.
   */
  getContrast(
    colorOne: string,
    colorTwo: string,
    contrastType: ContrastType,
    gamut: GamutMode = DEFAULT_GAMUT_MODE,
  ): number | null {
    const parsedOne = this.colorUtilService.parseColor(colorOne);
    const parsedTwo = this.colorUtilService.parseColor(colorTwo);
    if (!parsedOne || !parsedTwo) return null;

    // deltaE and wcag2 work in a continuous space, so they can score a color
    // that has no hex representation — `none` is meaningful for them.
    if (contrastType === 'deltaE' || contrastType === 'wcag2') {
      const c1 = applyGamut(parsedOne, gamut);
      const c2 = applyGamut(parsedTwo, gamut);
      return contrastType === 'deltaE'
        ? Math.round(c1.deltaE2000(c2))
        : parseFloat(c1.contrast(c2, 'WCAG21').toFixed(1));
    }

    // Everything below takes hex, so `none` throws rather than silently mapping.
    const h1 = toGamutHex(parsedOne, gamut);
    const h2 = toGamutHex(parsedTwo, gamut);

    if (contrastType === 'okca') {
      return this.okcaService.contrast(h1, h2);
    }

    // Plugin lookup for non-built-in types
    const plugin = this.pluginRegistry?.get(contrastType);
    if (plugin) {
      return plugin.calculate(h1, h2);
    }

    return null;
  }

  calculateOKCA(foreground: Color, background: Color, gamut: GamutMode = DEFAULT_GAMUT_MODE): number {
    const fgHex = toGamutHex(foreground, gamut);
    const bgHex = toGamutHex(background, gamut);
    const result = this.okcaService.contrast(fgHex, bgHex);
    if (result === null) {
      throw new Error('Unable to calculate OKCA contrast');
    }
    return result;
  }

  calcRawOkcaContrast(colorOne: string, colorTwo: string): number | null {
    return this.okcaService.contrast(colorOne, colorTwo);
  }
}
