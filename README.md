# klar

Color accessibility tools for AI coding agents and the terminal — powered by OKCA.

(Installed as the `klar-cli` package; the command is `klar`.)

[![npm version](https://img.shields.io/npm/v/klar-cli.svg)](https://www.npmjs.com/package/klar-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

All commands run locally with zero network calls.

## What this is

`klar` ships with **OKCA** (OK Contrast Algorithm) — a WCAG-compatible contrast
algorithm on the familiar 1–21 scale, with **zero false passes** against the
WCAG 2.x threshold across a 1,249-pair audit of Tailwind, the GOV.UK Design
System, and USWDS v3.x.

The problem OKCA solves:

> Hot pink (`#ff69b4`) on near-black (`#1a1a1a`) scores **6.6:1** under WCAG and
> passes AA. It's also illegible. A same-luminance neutral grey scores
> identically — the WCAG formula is blind to saturation.
>
> Full write-up: [Hot Pink Passes WCAG. That's the Problem.](https://pawn002.github.io/blog-public/blog/okca-algorithm/)

## Try it in 10 seconds

```bash
npx klar-cli contrast "#ff69b4" "#1a1a1a"
```

## Install

```bash
# Global CLI
npm install -g klar-cli
klar contrast "#fff" "#000"

# Or run without installing
npx klar-cli contrast "#fff" "#000"
```

## Contrast algorithms

Built-in (no plugin required): `okca` (default), `wcag2`, `deltaE`.

Additional contrast algorithms are available as optional, separately-installed
plugins discovered by the `klar-plugin-*` naming convention. Each plugin is
maintained and licensed independently — see [PLUGINS.md](PLUGINS.md).

## Global Options

| Flag | Description |
|------|-------------|
| `-v, --version` | Print version |
| `-h, --help` | Print help |
| `--no-plugins` | Disable discovery of contrast-algorithm plugins for this run; use built-in algorithms only |

Plugin loading can also be restricted via the `KLAR_PLUGINS` allowlist,
`KLAR_NO_PLUGINS`, or a `package.json` `"klar": { "plugins": [...] }` entry — see
[SECURITY.md](SECURITY.md).

## Output Modes

Every command supports three output modes (except `variants` which lacks `-q`):

| Flag | Behavior | Stdout format |
|------|----------|---------------|
| *(none)* | Human-readable with ANSI color swatches | Multi-line text |
| `--json` | Machine-readable structured data | Pretty-printed JSON |
| `-q, --quiet` | Single value only, no labels | Plain text, one line |

`--json` and `-q` write to stdout only, with no ANSI codes, making them safe for piping.

---

## Command Reference

### `contrast` — Calculate contrast between two colors

```
klar contrast <color1> <color2> [options]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `color1` | First color — hex, rgb(), oklch() |
| `color2` | Second color — hex, rgb(), oklch() |

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `-t, --type <type>` | `okca` | Algorithm: `okca`, `wcag2`, `deltaE` (built-in), plus any installed plugins |
| `--json` | | JSON output |
| `-q, --quiet` | | Print only the numeric contrast value |

**Built-in contrast algorithms:**

| Type | Range | Meaning |
|------|-------|---------|
| `okca` | 1 to 20.9 | OKCA: OKLCH-native, WCAG-compatible ratio. 0 false passes vs WCAG (1,249-pair audit). Polarity-aware — light-on-dark caps at 20.9, dark-on-light at 20. |
| `wcag2` | 1 to 21 | Traditional WCAG 2.x luminance ratio |
| `deltaE` | 0 to 100 | Delta E 2000 perceptual color difference |

Additional algorithms are available as optional plugins — see [PLUGINS.md](PLUGINS.md).

**JSON schema:**

```jsonc
{
  "contrast": 20.9,         // number — the calculated value
  "type": "okca",           // string — algorithm used
  "colorOne": "#ffffff",   // string — first color as provided
  "colorTwo": "#000000"    // string — second color as provided
}
```

**Quiet output:** single number, e.g. `20.9`

**Examples:**

```bash
klar contrast "#ffffff" "#000000"
klar contrast "#fff" "#000" --type wcag2
klar contrast "#fff" "#000" --type okca --json
klar contrast "oklch(50% 0.2 240)" "#000" -q
klar contrast "rgb(59,130,246)" "#ffffff" --type deltaE
```

---

### `pair` — Generate a random accessible color pair

```
klar pair [options]
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--min-lightness <n>` | | Minimum OKLCH lightness 0–100 |
| `--max-lightness <n>` | | Maximum OKLCH lightness 0–100 |
| `--json` | | JSON output |
| `-q, --quiet` | | Print only two hex values space-separated |

**JSON schema:**

```jsonc
{
  "colorOne": "#1c2333",   // string — foreground hex
  "colorTwo": "#ffe3e8",   // string — background hex
  "contrast": 11.9         // number — OKCA score between the pair
}
```

**Quiet output:** two hex values space-separated, e.g. `#1c2333 #ffe3e8`

**Examples:**

```bash
klar pair
klar pair --min-lightness 20 --max-lightness 80
klar pair --json
klar pair -q
```

---

### `meta` — Get OKLCH metadata for a color

```
klar meta <color> [options]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `color` | Color to analyze — hex, rgb(), oklch() |

**Options:**
| Flag | Description |
|------|-------------|
| `--json` | JSON output |
| `-q, --quiet` | Print L C H space-separated |

**JSON schema:**

```jsonc
{
  "color": "#3b82f6",      // string — input color
  "lightness": 0.62,       // number — OKLCH L (0–1 scale)
  "chroma": 0.19,          // number — OKLCH C (0–~0.4)
  "hue": 259.81,           // number — OKLCH H (0–360 degrees)
  "saturation": 30.17      // number — saturation percentage
}
```

**Quiet output:** `L C H` space-separated, e.g. `0.62 0.19 259.81`

**Examples:**

```bash
klar meta "#3b82f6"
klar meta "rgb(59, 130, 246)" --json
klar meta "#000000" -q
```

---

### `variants` — Generate a perceptually-spaced color variant grid

Two modes: **adaptive** (default) and **fixed-step**.

#### Adaptive mode (default)

The grid walks chroma first (at the base lightness), then lightness
independently per chroma level — so each column explores the full gamut
range at that chroma. Within each column, adjacent cells differ by at
least 11 Delta E 2000 (configurable via `--min-delta`). Only in-gamut
cells are emitted — no wasted tokens on out-of-gamut placeholders.

```
klar variants <color> [--min-delta <n>] [--json]
```

The grid size depends on the input color's sRGB gamut:
- **Neutral colors** (e.g. `#808080`) produce larger grids because
  they have wide gamut boundaries in both lightness and chroma.
- **High-chroma colors** (e.g. `#3b82f6`, `#ff6600`) produce smaller grids
  because their gamut is narrow — there are fewer perceptually distinct variants.

Each column has constant chroma with lightness decreasing top-to-bottom.
This is correct behavior, not a limitation — every cell in the output
is a meaningfully different color that an agent can act on.

#### Fixed-step mode

Activated by passing `--light-steps` and/or `--chroma-steps`, or by using `--color-space hsl`.
Divides the space into uniform intervals. May produce out-of-gamut cells (`"color": ""`).

```
klar variants <color> --light-steps <n> --chroma-steps <n> [--color-space <space>] [--json]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `color` | Base color — hex, rgb(), oklch() |

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--min-delta <n>` | `11` | Minimum Delta E 2000 between adjacent cells (adaptive mode) |
| `--light-steps <n>` | | Fixed lightness steps — activates fixed-step mode |
| `--chroma-steps <n>` | | Fixed chroma steps — activates fixed-step mode |
| `--color-space <space>` | `oklch` | `oklch` or `hsl` (hsl forces fixed-step mode) |
| `--json` | | JSON output |

No `-q` mode (grid data doesn't reduce to a single value).

**JSON schema:** 2D array `[row][col]`, each cell:

```jsonc
{
  "color": "#7f8895",         // string — hex (empty "" only in fixed-step mode)
  "lightness": 0.623,         // number — OKLCH L
  "chroma": 0.023,            // number — OKLCH C
  "hue": 259.81,              // number — OKLCH H
  "deltaE": 18,               // number — Delta E 2000 from base color
  "deltaChroma": -88,         // number — % chroma change from base
  "deltaLightness": 0         // number — % lightness change from base
}
```

In adaptive mode, every cell has a valid hex `color` — no empty strings.
In fixed-step mode, cells with `"color": ""` are out-of-gamut and should be skipped.

**Examples:**

```bash
# Adaptive (default) — perceptually-spaced, zero waste
klar variants "#3b82f6"
klar variants "#ff6600" --min-delta 15
klar variants "#3b82f6" --json

# Fixed-step — uniform intervals, may have out-of-gamut cells
klar variants "#3b82f6" --light-steps 10 --chroma-steps 5
klar variants "#3b82f6" --color-space hsl --light-steps 5 --chroma-steps 3
```

---

### `match` — Match chroma between two colors

Adjusts the first color's chroma to match the second color's chroma in OKLCH space.

```
klar match <color1> <color2> [options]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `color1` | Color to adjust |
| `color2` | Reference color (chroma source) |

**Options:**
| Flag | Description |
|------|-------------|
| `--json` | JSON output |
| `-q, --quiet` | Print two adjusted hex values space-separated |

**JSON schema:**

```jsonc
{
  "success": true,                   // boolean — false when no in-gamut match exists
  "colors": ["#f86d25", "#3b82f6"],  // [string, string] | null
  "chroma": 0.188                    // number — matched chroma value
}
```

When `success` is `false`, neither color can adopt the other's chroma within the
sRGB gamut: `colors` is `null` and the command **exits 1** (see [Exit Codes](#exit-codes)).

**Quiet output:** two hex values space-separated, e.g. `#f86d25 #3b82f6`

**Examples:**

```bash
klar match "#ff6600" "#3b82f6"
klar match "#ff6600" "#3b82f6" --json
klar match "#ff6600" "#3b82f6" -q
```

---

### `lightness` — Get min/max lightness for a color in sRGB gamut

Returns the OKLCH lightness boundaries where the color's hue + chroma remain displayable in sRGB.

```
klar lightness <color> [options]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `color` | Color to analyze — hex, rgb(), oklch() |

**Options:**
| Flag | Description |
|------|-------------|
| `--json` | JSON output |
| `-q, --quiet` | Print min and max space-separated |

**JSON schema:**

```jsonc
{
  "originalCoords": [0.623, 0.188, 259.81],  // [L, C, H] in OKLCH
  "lightMin": 0.466,                          // number — minimum L in gamut
  "lightMax": 0.648                           // number — maximum L in gamut
}
```

**Quiet output:** `min max` space-separated (4 decimal places), e.g. `0.4660 0.6480`

**Examples:**

```bash
klar lightness "#3b82f6"
klar lightness "#3b82f6" --json
klar lightness "#3b82f6" -q
```

---

### `find` — Find a color meeting a target contrast

Binary-searches OKLCH lightness to find a variation of the reference color that meets the target contrast against the base color. The target is a **floor** (a minimum): the result is guaranteed to be at or above it, returning the color closest to the target from above.

```
klar find <base-color> <reference-color> [options]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `base-color` | Color to keep fixed (e.g. background) |
| `reference-color` | Color to adjust (e.g. text) |

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--target <n>` | *(required)* | Target contrast value |
| `-t, --type <type>` | `okca` | Algorithm: `okca`, `wcag2`, `deltaE` (built-in), plus any installed plugins |
| `--tolerance <n>` | `0.5` | Acceptable overshoot above the target — the band within which the search stops early. Never accepts a result below the target. |
| `--json` | | JSON output |
| `-q, --quiet` | | Print only the adjusted hex color |

**JSON schema:**

```jsonc
{
  "adjustedColor": "#2563eb",    // string — result hex
  "actualContrast": 4.6,         // number — achieved contrast (of adjustedColor)
  "iterations": 10,              // number — binary search steps
  "success": true,               // boolean — true when actualContrast >= target
  "message": "",                 // string? — explanation if failed
  "oklch": {                     // object? — OKLCH of adjusted color
    "l": 0.523,
    "c": 0.188,
    "h": 259.8
  }
}
```

When `success` is `false` the target is unachievable by adjusting lightness
alone: `adjustedColor` holds the **closest reachable** color, `message` explains
why, and the command **exits 1** (see [Exit Codes](#exit-codes)).

**Quiet output:** adjusted hex, e.g. `#2563eb`. On a soft failure the closest
color is still printed, but the command exits `1` — so `$(klar find … -q)`
inside `&&` won't apply a non-compliant color.

**Examples:**

```bash
klar find "#ffffff" "#3b82f6" --target 4.5
klar find "#000000" "#cccccc" --target 4.5 --type wcag2
klar find "#ffffff" "#3b82f6" --target 4.5 --json
klar find "#ffffff" "#3b82f6" --target 4.5 -q
klar find "#ffffff" "#3b82f6" --target 7 --type okca --tolerance 0.1
```

---

### `plugins` — List registered contrast algorithm plugins

```
klar plugins list [options]
```

Lists every contrast-algorithm plugin klar discovered, with its source, package
name, version, and resolved path — so you can see exactly what third-party code
klar will run. Built-in algorithms (`okca`, `wcag2`, `deltaE`) are always
available and are not plugins. See [PLUGINS.md](PLUGINS.md) and [SECURITY.md](SECURITY.md).

**Options:**
| Flag | Description |
|------|-------------|
| `--json` | JSON output |
| `-q, --quiet` | Print only plugin ids, one per line |

**JSON schema:** array of objects, one per registered plugin:

```jsonc
[
  {
    "id": "cvd-brettel",                       // string — the --type value
    "displayName": "CVD (Brettel)",            // string — human-readable name
    "description": "…",                        // string — one-line summary
    "source": "global",                        // "project" | "global" | null
    "packageName": "klar-plugin-cvd-brettel",  // string | null
    "version": "1.0.0",                        // string | null
    "resolvedPath": "/abs/path/to/plugin"      // string | null
  }
]
```

**Quiet output:** plugin ids, one per line.

**Examples:**

```bash
klar plugins list
klar plugins list --json
klar plugins list -q
```

---

## Color Input Formats

All commands accept colors in these formats:

| Format | Example |
|--------|---------|
| Hex (6 digit) | `"#3b82f6"` |
| Hex (3 digit) | `"#fff"` |
| RGB function | `"rgb(59, 130, 246)"` |
| OKLCH function | `"oklch(62% 0.19 260)"` |

**Shell quoting**: Always quote colors containing `#` or parentheses to prevent shell interpretation:

```bash
klar contrast "#fff" "#000"             # Hex — must quote #
klar meta "rgb(59, 130, 246)"           # RGB — must quote parens
klar meta "oklch(62% 0.19 260)"         # OKLCH — must quote parens
```

---

## Advanced Workflows

> **For AI agents:** See [AGENT_PLAYBOOK.md](./AGENT_PLAYBOOK.md) for
> end-to-end art direction workflows — palette building, dark mode
> translation, accessibility auditing, and more.

### Scripting with `--json` and `jq`

```bash
# Extract just the contrast score from a check
klar contrast "#1a1a2e" "#e94560" --json | jq '.contrast'

# Compare the built-in algorithms for the same pair
for algo in okca wcag2 deltaE; do
  echo -n "$algo: "
  klar contrast "#1a1a2e" "#e94560" --type $algo -q
done

# Generate a pair and immediately check all algorithms
PAIR=$(klar pair --json)
FG=$(echo "$PAIR" | jq -r '.colorOne')
BG=$(echo "$PAIR" | jq -r '.colorTwo')
klar contrast "$FG" "$BG" --type wcag2 --json
```

### Finding accessible color variations

```bash
# Given a brand blue, find a shade that passes WCAG AA on white
klar find "#ffffff" "#3b82f6" --target 4.5 --type wcag2 -q

# Find accessible text for dark background
klar find "#1a1a2e" "#e94560" --target 4.5 --type okca --json

# Check if the result actually meets the target
ADJUSTED=$(klar find "#ffffff" "#3b82f6" --target 4.5 --type wcag2 -q)
klar contrast "#ffffff" "$ADJUSTED" --type wcag2 -q
```

### Analyzing gamut boundaries

```bash
# Get the lightness range for a color
klar lightness "#3b82f6" --json | jq '{min: .lightMin, max: .lightMax}'

# Check how much room to darken or lighten
META=$(klar meta "#3b82f6" --json)
RANGE=$(klar lightness "#3b82f6" --json)
echo "Current L: $(echo $META | jq '.lightness')"
echo "Range: $(echo $RANGE | jq '.lightMin') to $(echo $RANGE | jq '.lightMax')"
```

### Variant exploration

```bash
# Adaptive grid (default) — all cells are in-gamut and perceptually distinct
klar variants "#3b82f6" --json | jq '[.[][] | {color, lightness, deltaE}]'

# List all variant hexes for downstream use
klar variants "#3b82f6" --json | jq '[.[][] | .color]'

# Find the variant most different from the base
klar variants "#3b82f6" --json \
  | jq '[.[][]] | sort_by(-.deltaE) | .[0]'

# Use a tighter grid for more choices (minDelta=8)
klar variants "#808080" --min-delta 8 --json | jq '[.[][]] | length'

# Fixed-step mode when you need a specific grid size
klar variants "#ff6600" --light-steps 5 --chroma-steps 3 --json \
  | jq '[.[][] | select(.color != "") | {color, lightness, deltaE}]'
```

### Chroma matching for brand palettes

```bash
# Match chroma between brand primary and secondary
klar match "#ff6600" "#3b82f6" --json | jq '.chroma'

# Verify both colors now share the same chroma
MATCHED=$(klar match "#ff6600" "#3b82f6" --json)
C1=$(echo "$MATCHED" | jq -r '.colors[0]')
C2=$(echo "$MATCHED" | jq -r '.colors[1]')
echo "Color 1 chroma: $(klar meta "$C1" --json | jq '.chroma')"
echo "Color 2 chroma: $(klar meta "$C2" --json | jq '.chroma')"
```

### Combining commands in pipelines

```bash
# Full accessibility audit for a color pair
FG="#1a1a2e"
BG="#e94560"
echo "=== Color Pair Audit ==="
echo "Foreground: $FG"
klar meta "$FG" --json | jq '{L: .lightness, C: .chroma, H: .hue}'
echo "Background: $BG"
klar meta "$BG" --json | jq '{L: .lightness, C: .chroma, H: .hue}'
echo "---"
echo "OKCA:   $(klar contrast "$FG" "$BG" --type okca -q)"
echo "WCAG:   $(klar contrast "$FG" "$BG" --type wcag2 -q)"
echo "DeltaE: $(klar contrast "$FG" "$BG" --type deltaE -q)"
```

---

## Exit Codes

klar follows a grep-style convention so scripts can branch on the outcome:

| Code | Meaning |
|------|---------|
| `0` | Success — the operation produced a satisfying result |
| `1` | Soft failure — a valid operation whose answer is negative (`find` target unachievable, `match` infeasible) |
| `2` | Usage error — invalid input or arguments |

Usage errors (`2`) are written to stderr with an `Error:` prefix. On a soft
failure (`1`) the result payload is still written to **stdout** — `find` prints
the closest reachable color, `--json` reports `"success": false` — so the exit
code guards a pipeline while the data remains inspectable:

```bash
# Apply only when a compliant color was actually found
ADJUSTED=$(klar find "$BG" "$FG" --target 4.5 -q) && apply "$ADJUSTED" \
  || echo "no color meets the target on this background"
```

---

## Architecture

The CLI uses standalone service classes (no framework DI). Contrast algorithms are loaded via a plugin registry — built-in types (`okca`, `wcag2`, `deltaE`) plus any optional contrast-algorithm plugins discovered by the `klar-plugin-*` convention at runtime (see [PLUGINS.md](PLUGINS.md)).

---

## Development

```bash
npm install
npm run build       # Compile TypeScript to dist/
npm test            # Run tests
npm run dev         # Watch mode (tsc --watch)
```

## License

MIT
