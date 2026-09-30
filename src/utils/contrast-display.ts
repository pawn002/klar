/**
 * Contrast values as they are shown to the user.
 *
 * WCAG 2.x thresholds are unrounded ("at least 4.5:1"), so a wcag2 ratio is
 * compared at full precision and shown rounded *down* to one decimal. Rounding
 * to nearest let a true 4.458 display, and pass, as 4.5 (klar#17). Flooring
 * means a displayed value at or above a threshold always is. OKCA defines its
 * own one-decimal output, and deltaE is reported as an integer, so both pass
 * through unchanged.
 */
export function displayContrast(contrastType: string, value: number): number {
  if (contrastType !== 'wcag2') return value;
  // No epsilon: the displayed value must agree with the full-precision
  // comparison, so anything below a tenth, however slightly, floors below it.
  return Math.floor(value * 10) / 10;
}
