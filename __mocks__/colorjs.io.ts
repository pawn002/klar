/**
 * Mock for colorjs.io library
 * Provides simplified Color class for testing
 */

interface ColorSpace {
  id: string;
  coords: { name: string }[];
}

/**
 * Simplified Color class mock
 */
class Color {
  coords: [number, number, number];
  alpha: number;
  space: ColorSpace;

  constructor(
    color: string | Color | { space: string; coords: [number, number, number] },
    coords?: [number, number, number]
  ) {
    this.alpha = 1;

    // Handle two-argument constructor: new Color('oklch', [l, c, h])
    if (typeof color === 'string' && coords !== undefined) {
      this.coords = coords;
      this.space = this.getSpaceById(color);
      return;
    }

    if (typeof color === 'string') {
      const parsed = this.parseColorString(color);
      if (!parsed) {
        throw new Error(`Invalid color: ${color}`);
      }
      this.coords = parsed;
      this.space = this.detectSpace(color);
    } else if (color instanceof Color) {
      this.coords = [...color.coords] as [number, number, number];
      this.space = color.space;
      this.alpha = color.alpha;
    } else {
      this.coords = color.coords;
      this.space = this.getSpaceById(color.space);
    }
  }

  private parseColorString(color: string): [number, number, number] | null {
    // A few CSS named colors. Real colorjs.io knows the full set; these cover
    // what the specs use. Named colors are valid input to every klar command.
    const named: Record<string, string> = {
      white: '#ffffff',
      black: '#000000',
      red: '#ff0000',
      rebeccapurple: '#663399',
    };
    const lower = color.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(named, lower)) {
      color = named[lower];
    }

    // Parse hex colors
    if (color.startsWith('#')) {
      let hex = color.slice(1);
      // Real colorjs.io accepts 3-digit shorthand; expand it by doubling each
      // nibble so the mock does not under-report what klar actually accepts.
      if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return null; // Invalid hex
      }
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return [r, g, b];
    }

    // Parse rgb() colors
    if (color.startsWith('rgb')) {
      const matches = color.match(/\d+/g);
      if (matches && matches.length >= 3) {
        return [
          parseInt(matches[0]) / 255,
          parseInt(matches[1]) / 255,
          parseInt(matches[2]) / 255,
        ];
      }
      return null;
    }

    // Parse oklch() colors
    if (color.startsWith('oklch')) {
      const matches = color.match(/[\d.]+/g);
      if (matches && matches.length >= 3) {
        return [
          parseFloat(matches[0]),
          parseFloat(matches[1]),
          parseFloat(matches[2]),
        ];
      }
      return null;
    }

    // Invalid color format
    return null;
  }

  private detectSpace(color: string): ColorSpace {
    if (color.startsWith('oklch')) {
      return { id: 'oklch', coords: [{ name: 'l' }, { name: 'c' }, { name: 'h' }] };
    }
    return { id: 'srgb', coords: [{ name: 'r' }, { name: 'g' }, { name: 'b' }] };
  }

  private getSpaceById(id: string): ColorSpace {
    if (id === 'oklch') {
      return { id: 'oklch', coords: [{ name: 'l' }, { name: 'c' }, { name: 'h' }] };
    }
    if (id === 'oklab') {
      return { id: 'oklab', coords: [{ name: 'l' }, { name: 'a' }, { name: 'b' }] };
    }
    if (id === 'hsl') {
      return { id: 'hsl', coords: [{ name: 'h' }, { name: 's' }, { name: 'l' }] };
    }
    return { id: 'srgb', coords: [{ name: 'r' }, { name: 'g' }, { name: 'b' }] };
  }

  /**
   * Convert color to different color space
   */
  to(space: string): Color {
    if (space === this.space.id) {
      return new Color(this);
    }

    // HSL to sRGB conversion
    if (space === 'srgb' && this.space.id === 'hsl') {
      const [h, s, l] = this.coords;
      const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l / 100 - c / 2;

      let r = 0, g = 0, b = 0;
      if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
      } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
      } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
      } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
      } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
      } else {
        r = c; g = 0; b = x;
      }

      return new Color({ space: 'srgb', coords: [r + m, g + m, b + m] });
    }

    // sRGB to HSL conversion
    if (space === 'hsl' && this.space.id === 'srgb') {
      const [r, g, b] = this.coords;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));

        if (max === r) {
          h = 60 * (((g - b) / delta) % 6);
        } else if (max === g) {
          h = 60 * ((b - r) / delta + 2);
        } else {
          h = 60 * ((r - g) / delta + 4);
        }
      }

      if (h < 0) h += 360;

      return new Color({ space: 'hsl', coords: [h, s * 100, l * 100] });
    }

    // HSL to OKLCH (via sRGB)
    if (space === 'oklch' && this.space.id === 'hsl') {
      const srgb = this.to('srgb');
      return srgb.to('oklch');
    }

    // OKLCH to HSL (via sRGB)
    if (space === 'hsl' && this.space.id === 'oklch') {
      const srgb = this.to('srgb');
      return srgb.to('hsl');
    }

    if (space === 'srgb' && this.space.id === 'oklch') {
      // Simplified OKLCH to sRGB conversion
      const [l, c, h] = this.coords;
      // This is highly simplified and not accurate
      const r = l + c * Math.cos((h * Math.PI) / 180);
      const g = l;
      const b = l - c * Math.sin((h * Math.PI) / 180);
      return new Color({ space: 'srgb', coords: [r, g, b] });
    }

    if (space === 'oklch' && this.space.id === 'srgb') {
      // Correct sRGB → OKLCH via Oklab (Ottosson 2020).
      // Derives from the already-correct sRGB→Oklab transform, so L values
      // now match real colorjs.io (e.g. #767676 → L≈0.566, not 0.463).
      const oklab = this.to('oklab');
      const [L, a, b] = oklab.coords;
      const C = Math.sqrt(a * a + b * b);
      let H = Math.atan2(b, a) * (180 / Math.PI);
      if (H < 0) H += 360;
      return new Color({ space: 'oklch', coords: [L, C, H] });
    }

    if (space === 'oklab' && this.space.id === 'srgb') {
      // Correct sRGB → Oklab transform (Ottosson 2020)
      const lin = (c: number) =>
        c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      const [r, g, b] = this.coords.map(lin);
      const lms_l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
      const lms_m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
      const lms_s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
      const l_ = Math.cbrt(lms_l);
      const m_ = Math.cbrt(lms_m);
      const s_ = Math.cbrt(lms_s);
      const L =  0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
      const A =  1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
      const B =  0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
      return new Color({ space: 'oklab', coords: [L, A, B] });
    }

    if (space === 'oklab' && this.space.id === 'oklch') {
      return this.to('srgb').to('oklab');
    }

    // Default: return copy in same space
    return new Color(this);
  }

  /**
   * Convert to string
   */
  toString(options?: { format?: string; precision?: number }): string {
    if (this.space.id === 'srgb') {
      const format = options?.format || 'hex';
      if (format === 'hex') {
        const r = Math.round(this.coords[0] * 255).toString(16).padStart(2, '0');
        const g = Math.round(this.coords[1] * 255).toString(16).padStart(2, '0');
        const b = Math.round(this.coords[2] * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
      return `rgb(${Math.round(this.coords[0] * 255)}, ${Math.round(this.coords[1] * 255)}, ${Math.round(this.coords[2] * 255)})`;
    }

    if (this.space.id === 'oklch') {
      const [l, c, h] = this.coords;
      return `oklch(${l.toFixed(2)} ${c.toFixed(2)} ${h.toFixed(0)})`;
    }

    return 'color(unknown)';
  }

  /**
   * Get specific coordinate
   */
  get(coord: string): number {
    if (this.space.id === 'srgb') {
      if (coord === 'r') return this.coords[0];
      if (coord === 'g') return this.coords[1];
      if (coord === 'b') return this.coords[2];
    }
    if (this.space.id === 'oklch') {
      if (coord === 'l') return this.coords[0];
      if (coord === 'c') return this.coords[1];
      if (coord === 'h') return this.coords[2];
    }
    return 0;
  }

  /**
   * Set specific coordinate
   */
  set(coord: string, value: number): Color {
    const newColor = new Color(this);
    if (this.space.id === 'srgb') {
      if (coord === 'r') newColor.coords[0] = value;
      if (coord === 'g') newColor.coords[1] = value;
      if (coord === 'b') newColor.coords[2] = value;
    }
    if (this.space.id === 'oklch') {
      if (coord === 'l') newColor.coords[0] = value;
      if (coord === 'c') newColor.coords[1] = value;
      if (coord === 'h') newColor.coords[2] = value;
    }
    return newColor;
  }

  /**
   * Check if color is in gamut
   */
  inGamut(space?: string): boolean {
    const targetSpace = space || this.space.id;
    if (targetSpace === 'srgb') {
      const rgb = this.space.id === 'srgb' ? this : this.to('srgb');
      return rgb.coords.every(c => c >= 0 && c <= 1);
    }
    return true; // Simplified: assume OKLCH is always in gamut
  }

  /**
   * Clone the color
   */
  clone(): Color {
    return new Color(this);
  }

  /**
   * Calculate deltaE (simplified)
   */
  deltaE(other: Color | string, method?: string): number {
    const otherColor = typeof other === 'string' ? new Color(other) : other;

    // Simplified deltaE calculation (not accurate, but good for testing)
    const diff0 = this.coords[0] - otherColor.coords[0];
    const diff1 = this.coords[1] - otherColor.coords[1];
    const diff2 = this.coords[2] - otherColor.coords[2];

    return Math.sqrt(diff0 * diff0 + diff1 * diff1 + diff2 * diff2) * 100;
  }

  /**
   * Calculate deltaE2000 (simplified)
   * Converts both colors to sRGB first so results are space-independent.
   */
  deltaE2000(other: Color | string): number {
    const otherColor = typeof other === 'string' ? new Color(other) : other;
    const thisRgb = this.space.id === 'srgb' ? this : this.to('srgb');
    const otherRgb = otherColor.space.id === 'srgb' ? otherColor : otherColor.to('srgb');
    const diff0 = thisRgb.coords[0] - otherRgb.coords[0];
    const diff1 = thisRgb.coords[1] - otherRgb.coords[1];
    const diff2 = thisRgb.coords[2] - otherRgb.coords[2];
    return Math.sqrt(diff0 * diff0 + diff1 * diff1 + diff2 * diff2) * 100;
  }

  /**
   * Convert to gamut (simplified)
   */
  toGamut(options?: { space?: string; method?: string }): Color {
    const targetSpace = options?.space || this.space.id;
    const newColor = this.to(targetSpace);

    // Clamp RGB values to 0-1 if in sRGB space
    if (targetSpace === 'srgb') {
      newColor.coords = newColor.coords.map(c => Math.max(0, Math.min(1, c))) as [number, number, number];
    }

    return newColor;
  }

  /**
   * Calculate WCAG 2.x contrast ratio
   */
  contrast(other: Color | string, algorithm?: string): number {
    const otherColor = typeof other === 'string' ? new Color(other) : other;

    // Convert both to sRGB
    const thisRgb = this.space.id === 'srgb' ? this : this.to('srgb');
    const otherRgb = otherColor.space.id === 'srgb' ? otherColor : otherColor.to('srgb');

    // Calculate relative luminance (simplified)
    const getLuminance = (rgb: [number, number, number]): number => {
      const [r, g, b] = rgb.map(val => {
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(thisRgb.coords);
    const l2 = getLuminance(otherRgb.coords);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Static parse method
   */
  static parse(color: string): Color | null {
    try {
      return new Color(color);
    } catch {
      return null; // Return null for invalid colors
    }
  }

  /**
   * Static to method (convert color to different space)
   */
  static to(color: Color | string, space: string): Color {
    const colorObj = typeof color === 'string' ? new Color(color) : color;
    return colorObj.to(space);
  }
}

// Export as default
export default Color;
