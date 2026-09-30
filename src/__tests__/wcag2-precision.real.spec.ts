import Color from 'colorjs.io';
import { getServices } from '../services';
import { displayContrast } from '../utils/contrast-display';

/**
 * klar#17: wcag2 ratios were rounded to one decimal *before* being compared,
 * so a color with a true ratio in [4.45, 4.5) passed a 4.5 target. WCAG 2.x
 * thresholds are unrounded. Found by the skill-vs-playbook agent eval, where
 * `find -t wcag2 --allow-desaturation` returned #068a3d (true 4.458) as a pass.
 */
describe('wcag2 precision (klar#17)', () => {
  const { colorUtilService, colorMetricsService } = getServices();
  const exact = (a: string, b: string) => new Color(a).contrast(new Color(b), 'WCAG21');

  it('the regression fixture really sits in the band that used to round up', () => {
    const r = exact('#068a3d', '#ffffff');
    expect(r).toBeGreaterThanOrEqual(4.45);
    expect(r).toBeLessThan(4.5);
  });

  it('never displays a sub-threshold ratio as the threshold', () => {
    expect(colorMetricsService.getContrast('#068a3d', '#ffffff', 'wcag2')).toBe(4.4);
  });

  it('find only reports success for a color that truly meets the target', () => {
    const result = colorUtilService.findColorForTargetContrast({
      baseColor: '#ffffff',
      referenceColor: '#22c55e',
      targetContrast: 4.5,
      contrastType: 'wcag2',
      allowDesaturation: true,
    });
    expect(result.success).toBe(true);
    expect(exact(result.adjustedColor, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    // The displayed figure agrees with the verdict.
    expect(result.actualContrast).toBeGreaterThanOrEqual(4.5);
  });

  it('lightness-only find is judged at full precision too', () => {
    const result = colorUtilService.findColorForTargetContrast({
      baseColor: '#ffffff',
      referenceColor: '#3b82f6',
      targetContrast: 4.5,
      contrastType: 'wcag2',
    });
    if (result.success) expect(exact(result.adjustedColor, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('displayContrast', () => {
  it('floors wcag2 to one decimal', () => {
    expect(displayContrast('wcag2', 4.458)).toBe(4.4);
    expect(displayContrast('wcag2', 5.564)).toBe(5.5);
    expect(displayContrast('wcag2', 21)).toBe(21);
  });

  it('agrees with the full-precision comparison right at a threshold', () => {
    // Anything below 4.5, however slightly, fails a 4.5 target, so it must not display as 4.5.
    expect(displayContrast('wcag2', 4.4999999999)).toBe(4.4);
    expect(displayContrast('wcag2', 4.5)).toBe(4.5);
  });

  it('shows every exact one-decimal ratio unchanged', () => {
    for (let i = 10; i <= 210; i++) expect(displayContrast('wcag2', i / 10)).toBe(i / 10);
  });

  it('leaves okca and deltaE alone', () => {
    expect(displayContrast('okca', 4.3)).toBe(4.3);
    expect(displayContrast('deltaE', 13)).toBe(13);
  });
});
