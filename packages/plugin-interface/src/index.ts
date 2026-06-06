/**
 * Contract that every klar contrast-algorithm plugin must implement.
 *
 * A plugin is identified by a unique string `id` that callers pass as the
 * `contrastType` argument throughout the CLI, REST API, and MCP layer.
 */
export interface ContrastPlugin {
  /**
   * Unique, URL-safe identifier.
   * This string becomes the --type value in the CLI and the contrastType
   * field in API/MCP requests.  Must not collide with built-in types
   * ('okca', 'wcag2', 'deltaE').
   *
   * @example 'mymetric'
   */
  readonly id: string;

  /**
   * Short human-readable name shown in `klar plugins list` and the REST
   * discovery endpoint.
   *
   * @example 'My Metric'
   */
  readonly displayName: string;

  /**
   * One-sentence description of the algorithm, its output range, and any
   * relevant licensing or usage notes.
   */
  readonly description: string;

  /**
   * Unit label for the value returned by `calculate()`.
   * Omit for dimensionless contrast values (ratio, score, etc.).
   *
   * @example 'px'
   */
  readonly unit?: string;

  /**
   * Semantic category of the calculated value.
   * - `'contrast'` — a contrast ratio or perceptual contrast score (default)
   * - `'dimension'` — a physical size in the units given by `unit`
   *
   * Display layers use this to choose appropriate labels and formatting.
   */
  readonly category?: 'contrast' | 'dimension';

  /**
   * Calculate the contrast between two colors.
   *
   * @param colorOne - Foreground / text color as a CSS color string (hex,
   *   rgb(), oklch(), etc.).
   * @param colorTwo - Background color in the same formats.
   * @returns A numeric value whose meaning is algorithm-specific (see
   *   `unit` and `category`), or `null` if either color cannot be parsed
   *   or the calculation fails.
   */
  calculate(colorOne: string, colorTwo: string): number | null;
}
