import Color from 'colorjs.io';
import { ContrastType } from './types';
import { ColorUtilService } from './color-util.service';
import { OkcaService } from './okca.service';
import { PluginRegistry } from '@pawn002/klar-plugin-registry';

export class ColorMetricsService {
  constructor(
    private readonly colorUtilService: ColorUtilService,
    private readonly okcaService: OkcaService,
    private readonly pluginRegistry?: PluginRegistry,
  ) {}

  getContrast(colorOne: string, colorTwo: string, contrastType: ContrastType): number | null {
    const parsedOne = this.colorUtilService.parseColor(colorOne);
    const parsedTwo = this.colorUtilService.parseColor(colorTwo);
    if (!parsedOne || !parsedTwo) return null;

    if (contrastType === 'deltaE') {
      return this.colorUtilService.calcDeltaE(colorOne, colorTwo);
    }

    if (contrastType === 'wcag2') {
      return this.colorUtilService.calcWcag2(colorOne, colorTwo);
    }

    if (contrastType === 'okca') {
      const h1 = this.colorUtilService.toHex(parsedOne);
      const h2 = this.colorUtilService.toHex(parsedTwo);
      return this.okcaService.contrast(h1, h2);
    }

    // Plugin lookup for non-built-in types
    const plugin = this.pluginRegistry?.get(contrastType);
    if (plugin) {
      const h1 = this.colorUtilService.toHex(parsedOne);
      const h2 = this.colorUtilService.toHex(parsedTwo);
      return plugin.calculate(h1, h2);
    }

    return null;
  }

  calculateOKCA(foreground: Color, background: Color): number {
    const fgHex = foreground.to('srgb').toString({ format: 'hex' });
    const bgHex = background.to('srgb').toString({ format: 'hex' });
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
