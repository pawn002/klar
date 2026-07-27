# klar Agent Playbook — Art Direction Workflows

Reference for AI agents using klar CLI tools to accomplish common art
direction tasks. Each workflow describes the goal, the reasoning, and
the exact command chain.

All commands assume `klar` is on PATH.

---

## Key concepts agents must understand

**OKCA is the default contrast algorithm.** OKCA (OK Contrast
Algorithm) returns WCAG 2.x-compatible contrast ratios on the familiar
WCAG scale, with improved perceptual modeling. It is the CLI default —
no `--type` flag needed. Ratios run from 1 to 20.9; the top of the
range is 20.9 rather than 21 because the caps are polarity-aware (see
below), so do not treat 21 as a reachable value.

**OKCA is polarity-aware — argument order matters.** Throughout this
playbook the convention is `klar contrast <foreground> <background>`.
Light-on-dark pairs score up to 20.9; dark-on-light pairs are capped at
20 because the same luminance contrast is perceived as weaker when the
text is darker than its surround. Concretely:
`contrast "#fff" "#000"` = 20.9, but `contrast "#000" "#fff"` = 20.

Chromatic pairs are asymmetric too, and the gap is small enough that it
can decide an AA verdict. `contrast "#fff" "#0055ff"` = 4.5 (passes AA
body text), but `contrast "#0055ff" "#fff"` = 4.3 (fails). Always run
`contrast` in the direction colors will actually be used
(text-on-background), not its reverse — and never reuse a ratio you
measured in the opposite order.

**Built-in contrast algorithms (via `--type`):**
- `okca` (default) — WCAG 2.x-compatible ratio, polarity-aware
- `wcag2` — classic WCAG 2.x luminance ratio, symmetric
- `deltaE` — perceptual color difference (see below)

Additional contrast algorithms may be available as optional plugins
installed in the environment. Run `klar plugins list` to see what is
registered; each plugin self-declares its `--type` id, value range, and
meaning. Plugins are installed and licensed separately — see PLUGINS.md.

**Delta E 2000 is the art director's metric.** It answers "can a human tell
these two colors apart?" Values below 3 are imperceptible. Around 5 is
noticeable. 11+ is clearly different. When an art director asks "did it
change much?", they want deltaE, not a contrast ratio.

**OKLCH is the working color space.** Lightness (L), chroma (C), hue (H).
Adjusting L alone changes how light/dark a color is without shifting its
character. Adjusting C changes saturation. H changes the color family.
Use `meta` to understand any color in these terms before manipulating it.

**Gamut matters.** Not every OKLCH coordinate maps to a displayable sRGB
color. Use `lightness` to find the actual L range for a given C and H.
The adaptive `variants` grid already handles this — every cell it emits
is in-gamut.

---

## Workflow 1 — Build a palette from a hero color

**Situation:** The art director gives you a brand color and says "build me
a palette — I need lighter and darker shades that are all accessible on
white."

### Step 1: Understand the color

```bash
klar meta "#3b82f6" --json
```

Read the OKLCH values. Note the chroma and hue — these define the color's
character. All variants should preserve the hue.

### Step 2: Generate perceptually-spaced variants

```bash
klar variants "#3b82f6" --json
```

The adaptive grid walks chroma first, then lightness independently per
chroma level. Each column has constant chroma with lightness decreasing
top-to-bottom. Within each column, adjacent cells differ by >= 11 deltaE.
High-chroma colors like saturated blue will yield smaller grids because
their gamut is genuinely narrow. This is correct — there aren't many
distinguishable shades.

If you need a uniform grid instead of the adaptive one (e.g. to populate
a design-system scale at a specific size), `variants` also accepts
`--light-steps N`, `--chroma-steps N`, and `--color-space hsl` as
escape hatches. The output schema is identical; only the cell layout
changes.

### Step 3: Check each variant against the background

```bash
VARIANTS=$(klar variants "#3b82f6" --json | jq -r '[.[][] | .color] | .[]')
BG="#ffffff"
for V in $VARIANTS; do
  OKCA=$(klar contrast "$V" "$BG" -q)   # variant as foreground, BG as background
  echo "$V  OKCA=$OKCA"
done
```

`contrast` is polarity-aware: always pass the role each color plays in
the real UI. A variant used as text on a white background must be
checked as `contrast "$VARIANT" "$BG"`, not the reverse.

### Step 4: Filter to accessible candidates

WCAG thresholds:
- **Body text** (< 24px): >= 4.5
- **Large text** (24px+): >= 3.0
- **Non-text UI** (icons, borders): >= 3.0

Keep only the variants that meet the required threshold.
Present the accessible variants to the art director with their OKCA
scores so they can choose based on aesthetics.

---

## Workflow 2 — Create a dark mode palette

**Situation:** The art director has a light-mode palette and wants dark
mode equivalents that maintain the same visual character.

### Step 1: Analyze the light-mode palette

For each color, extract its OKLCH profile:

```bash
for COLOR in "#3b82f6" "#e94560" "#22c55e" "#f5f5f5"; do
  echo "---"
  klar meta "$COLOR" --json | jq '{color: .color, L: .lightness, C: .chroma, H: .hue}'
done
```

### Step 2: Find dark-mode equivalents

For each color, find a version that meets contrast against the dark
background. `find <base> <reference>` keeps `base` fixed and adjusts
the `reference` color's OKLCH lightness — chroma and hue are preserved.
Pass the background as `base` and the original foreground as
`reference`:

```bash
DARK_BG="#1a1a2e"
ORIGINAL="#3b82f6"
klar find "$DARK_BG" "$ORIGINAL" --target 4.5 --json
```

Internally `find` evaluates OKCA as `(adjusted-foreground, background)`,
so the `actualContrast` in the result corresponds to the polarity the
adjusted color will be used in.

**`find` moves lightness only — check `success` before using the
result.** A saturated color has a narrow in-gamut lightness band, and
`find` cannot leave it. The command above is one of those cases:

```jsonc
{
  "adjustedColor": "#438aff",
  "actualContrast": 2.2,
  "success": false,          // 4.5 unreachable — exit code is 1
  "message": "Target contrast 4.5 not achievable by adjusting lightness only (closest reached: 2.2). ..."
}
```

`klar find` still prints its closest attempt on failure, so never apply
the output without checking `success` (or the exit code).

Diagnose it with `lightness`, which reports the sRGB-displayable L range
at that color's chroma and hue:

```bash
klar lightness "$ORIGINAL" --json
# { "lightMin": 0.466, "lightMax": 0.648, ... }
```

Blue at chroma 0.188 can only live between L 0.466 and L 0.648 — there
is no lighter version of *that* blue to move to. When this happens, the
chroma has to give. Pull candidates from `variants` (which walks chroma
as well as lightness) and keep the ones that clear the target:

```bash
for V in $(klar variants "$ORIGINAL" --json | jq -r '.[][] | .color'); do
  OKCA=$(klar contrast "$V" "$DARK_BG" -q)
  awk -v c="$OKCA" -v v="$V" 'BEGIN { if (c >= 4.5) print v, c }'
done
# #cfd2d7 10.4
# #bcd3f9 10
# #a6a9ae 6.4
# #94aace 5.9
```

`#bcd3f9` is the pick here — it keeps the most chroma of the four while
clearing 4.5 comfortably.

Report the trade to the art director explicitly: the color passes now,
but it is less saturated than the brand blue.

### Step 3: Measure how much each color shifted

The art director will ask "did it change much?" Compute deltaE between
the original and whatever you settled on. Gate on `find`'s exit code so
a failed search never silently becomes the answer:

```bash
if ADJUSTED=$(klar find "$DARK_BG" "$ORIGINAL" --target 4.5 -q); then
  klar contrast "$ORIGINAL" "$ADJUSTED" --type deltaE -q
else
  echo "lightness alone was not enough — fall back to the variants sweep above"
fi
```

A deltaE under 10 means the color kept its character. Over 20 means it
shifted substantially — flag this for the art director's review. The
`#bcd3f9` chosen above is a deltaE of 25 from the brand blue: it passes,
but it is a visibly different color and the art director has to sign off
on it. That is the honest report, not a silent substitution.

### Step 4: Align chromas across the palette

Dark mode colors can end up with mismatched saturation. Use `match` to
align them:

```bash
klar match "$ADJUSTED_PRIMARY" "$ADJUSTED_ACCENT" --json
```

This adjusts one color's chroma to match the other, keeping them
visually harmonious.

---

## Workflow 3 — Audit an existing color system

**Situation:** The art director hands you a set of design tokens and asks
"does this pass accessibility?"

### Step 1: Define the colors and their roles

Identify which colors serve as backgrounds and which as foregrounds.
A typical system:

```bash
BACKGROUNDS=("#ffffff" "#f5f5f5" "#1a1a2e")
FOREGROUNDS=("#1a1a2e" "#3b82f6" "#e94560" "#22c55e" "#666666")
```

### Step 2: Test every pair

```bash
for BG in "#ffffff" "#f5f5f5" "#1a1a2e"; do
  echo "=== On $BG ==="
  for FG in "#1a1a2e" "#3b82f6" "#e94560" "#22c55e" "#666666"; do
    [ "$FG" = "$BG" ] && continue
    OKCA=$(klar contrast "$FG" "$BG" -q)
    echo "  $FG  OKCA=$OKCA"
  done
done
```

### Step 3: Flag failures

| Use case | Threshold |
|----------|-----------|
| Body text (< 24px) | >= 4.5 |
| Large text (24px+) | >= 3.0 |
| UI components | >= 3.0 |

Any pair below threshold is a failure. Report:
- Which pair failed
- What it scored
- How far below threshold it is

### Step 4: Suggest fixes for failures

For each failing pair, use `find` to propose an adjusted foreground:

```bash
ADJUSTED=$(klar find "$BG" "$FG" --target 4.5 -q)
DRIFT=$(klar contrast "$FG" "$ADJUSTED" --type deltaE -q)
echo "Suggest $FG → $ADJUSTED (deltaE drift: $DRIFT)"
```

Present the fix with its deltaE drift so the art director can judge
whether the adjustment is acceptable.

---

## Workflow 4 — Nudge a color to pass without ruining it

**Situation:** "I love this coral but it doesn't pass on white. Fix it
but keep it as close as possible."

### Step 1: Measure the current state

```bash
COLOR="#e94560"
BG="#ffffff"
klar contrast "$COLOR" "$BG" -q          # Current OKCA ratio
klar meta "$COLOR" --json                 # Current OKLCH
```

### Step 2: Find the minimum adjustment

```bash
ADJUSTED=$(klar find "$BG" "$COLOR" --target 4.5 --json)
echo "$ADJUSTED" | jq '{adjusted: .adjustedColor, okca: .actualContrast, oklch: .oklch}'
```

### Step 3: Quantify the perceptual shift

```bash
ADJ_HEX=$(echo "$ADJUSTED" | jq -r '.adjustedColor')
klar contrast "$COLOR" "$ADJ_HEX" --type deltaE -q
```

Present this to the art director as: "To hit WCAG 4.5:1, the coral shifts
from `#e94560` to `$ADJ_HEX` — a deltaE of X. Here's what changed in
OKLCH terms:"

```bash
echo "Original:"
klar meta "$COLOR" --json | jq '{L: .lightness, C: .chroma, H: .hue}'
echo "Adjusted:"
klar meta "$ADJ_HEX" --json | jq '{L: .lightness, C: .chroma, H: .hue}'
```

The art director can then see that only lightness changed while chroma
and hue were preserved.

---

## Other commands worth knowing

**`pair`** generates a random color pair that meets a target OKCA
contrast. Useful as a seed for accent exploration or when you need an
accessible pair to demonstrate something quickly. Note that its
lightness bounds are on a **0–100** scale, unlike the 0–1 OKLCH `L`
that `meta` and `lightness` report.

```bash
klar pair --json
# {"colorOne":"#212535","colorTwo":"#ffe3e9","contrast":11.5}
klar pair --min-lightness 40 --max-lightness 90 -q
# space-separated hex pair, no JSON
```

**`plugins list`** prints every contrast algorithm plugin registered in
the current environment. When in doubt about which `--type` values are
available beyond the built-ins (`okca`, `wcag2`, `deltaE`), run this
first:

```bash
klar plugins list
# lists installed plugins with their ids and descriptions
```

---

## Workflow 5 — Choose accent colors that work together

**Situation:** "Give me 5 accent colors that all look different from
each other and all work on this background."

### Step 1: Generate candidates from variants

```bash
klar variants "$BASE_COLOR" --min-delta 11 --json \
  | jq '[.[][] | .color]'
```

The adaptive grid guarantees that vertical neighbors (within a column)
differ by >= 11 deltaE, and non-adjacent cells may be even more distinct.

### Step 2: Check mutual distinctness

For every pair of candidates, verify they are distinguishable:

```bash
COLORS=("#3b82f6" "#1e65d7" "#84878c" "#596d8f" "#6a6d71")
for i in "${!COLORS[@]}"; do
  for j in $(seq $((i+1)) $((${#COLORS[@]}-1))); do
    DE=$(klar contrast "${COLORS[$i]}" "${COLORS[$j]}" --type deltaE -q)
    echo "${COLORS[$i]} vs ${COLORS[$j]}: deltaE=$DE"
  done
done
```

All pairs should have deltaE >= 11 (or whatever the art director's
threshold is). Drop any color that is too similar to another.

### Step 3: Verify all pass contrast against the background

```bash
BG="#ffffff"
for C in "${COLORS[@]}"; do
  OKCA=$(klar contrast "$C" "$BG" -q)
  echo "$C  OKCA=$OKCA"
done
```

### Step 4: Align chromas for visual harmony

Accents that share the same chroma look intentional rather than random.
Pick one as the reference and match the others:

```bash
REF="${COLORS[0]}"
for C in "${COLORS[@]:1}"; do
  klar match "$REF" "$C" --json | jq '{matched: .colors, chroma: .chroma}'
done
```

After matching, re-verify contrast (chroma changes can shift OKCA
slightly).

---

## Quick reference — which command answers which question

| Art director asks... | Command chain |
|---------------------|---------------|
| "What color is this in OKLCH?" | `meta <color>` |
| "Does this pair pass?" | `contrast <fg> <bg>` (order matters — OKCA is polarity-aware) |
| "Show me lighter/darker options" | `variants <color>` |
| "How far can I lighten this?" | `lightness <color>` |
| "Make this pass on white" | `find <bg> <color> --target 4.5` |
| "Did that adjustment change much?" | `contrast <original> <adjusted> --type deltaE` |
| "Match the saturation of these two" | `match <color1> <color2>` |
| "Is this distinguishable from that?" | `contrast <a> <b> --type deltaE` (>= 11 means clearly different) |
| "Give me a random accessible pair" | `pair` |
| "Which contrast algorithms are available?" | `plugins list` |

---

## DeltaE interpretation guide

| DeltaE | Meaning | Art direction implication |
|--------|---------|--------------------------|
| 0-3 | Imperceptible | Same color for all practical purposes |
| 3-5 | Barely noticeable | Only visible in side-by-side comparison |
| 5-10 | Noticeable | A subtle but real shift — acceptable for dark mode translations |
| 11-20 | Clearly different | Distinct enough for palette members |
| 20-40 | Very different | Different colors — appropriate for accent vs primary |
| 40+ | Unrelated | No visual kinship |

---

## WCAG contrast thresholds

| Content type | Min ratio | WCAG level | Typical use |
|-------------|-----------|------------|-------------|
| Body text (< 24px) | 4.5 | AA | Paragraphs, form labels |
| Large text (24px+ / 18.66px+ bold) | 3.0 | AA | Headings, hero text |
| Non-text UI | 3.0 | AA | Icons, borders, focus rings |
| Body text (< 24px) | 7.0 | AAA | Enhanced readability |
| Large text (24px+) | 4.5 | AAA | Enhanced headings |

---

## Adding klar to your project's CLAUDE.md

Paste one of the snippets below into your project's `CLAUDE.md` (or
equivalent agent instructions file) so that Claude Code and other AI
agents know how to use klar when working in your codebase.

### Minimal snippet

Use this if you just want the agent to know `klar` exists and where to
learn more:

```markdown
## Color Accessibility

This project uses [klar CLI](https://github.com/pawn002/klar)
for color accessibility checks. `klar` is available on PATH.

When working with colors, use `klar` commands:
- `klar contrast <fg> <bg>` — check contrast (OKCA ratio, WCAG-compatible)
- `klar find <bg> <color> --target 4.5` — adjust a color to pass
- `klar meta <color>` — inspect OKLCH values
- `klar variants <color>` — generate palette options
Always use `--json` for programmatic consumption and `-q` for single values.

For complete workflow guidance, see: AGENT_PLAYBOOK.md in the klar repo.
```

### Full snippet (recommended)

Use this when agents will routinely do art direction tasks in your
project — palette work, dark mode, auditing design tokens:

```markdown
## Color Accessibility — klar

This project uses klar CLI (`klar`) for all color accessibility work.
When asked to check, generate, or modify colors, always use `klar`
rather than manual calculation or third-party web tools.

### Key rules
- **OKCA is the default.** OKCA returns WCAG 2.x-compatible ratios from 1 to
  20.9 with improved perceptual modeling. No `--type` flag needed. 21 is not
  reachable — the caps are polarity-aware.
- **OKCA is polarity-aware.** Argument order matters: always use
  `klar contrast <foreground> <background>`. Light-on-dark caps at 20.9;
  dark-on-light caps at 20. The same chromatic pair returns different
  numbers when swapped, and the gap can flip an AA verdict — never reuse a
  ratio measured in the opposite order.
- **Other algorithms via `--type`:** built-ins are `wcag2` and `deltaE`.
  Additional algorithms may be available as optional plugins — run
  `klar plugins list` to see what's registered in this environment.
- **Use OKLCH thinking.** Understand colors via `klar meta` before modifying.
- **deltaE measures perceptual drift.** Use `klar contrast <a> <b> --type deltaE`
  to quantify how much a color changed. < 3 is imperceptible, 11+ is clearly different.
- **Always verify after adjusting.** After `klar find` or `klar match`, re-check
  contrast and deltaE to confirm the result.
- **Check the exit code.** `find`/`match` exit `1` when the target can't be met
  (the closest result is still printed — don't apply it blindly), `2` on invalid
  input, `0` on success. In scripts, gate on it:
  `c=$(klar find "<bg>" "<color>" --target 4.5 -q) && use "$c" || handle_failure`.

### WCAG thresholds
| Content | Min ratio |
|---------|-----------|
| Body text (< 24px) | 4.5 |
| Large text (24px+) | 3.0 |
| Non-text UI | 3.0 |

### Common workflows

**Check a pair:**
`klar contrast "<fg>" "<bg>" -q`

**Make a color pass on a background:**
`klar find "<bg>" "<color>" --target 4.5 --json`

**Build a palette from a hero color:**
1. `klar variants "<color>" --json` — get perceptually-spaced options
2. Loop each variant through `klar contrast` against the background
3. Filter to those meeting the WCAG threshold

**Audit design tokens:**
For every foreground/background pair used in the design system, run:
`klar contrast "<fg>" "<bg>" -q`
Flag any pair below the threshold for its content type.

**Nudge a color minimally:**
1. `klar find "<bg>" "<color>" --target 4.5 -q` — get adjusted color
2. `klar contrast "<original>" "<adjusted>" --type deltaE -q` — measure drift
3. Report both the new color and the deltaE so the designer can decide

**Match saturation across palette:**
`klar match "<reference>" "<target>" --json`
Then re-verify contrast for the matched color.

For the full playbook with 5 end-to-end workflows, see:
AGENT_PLAYBOOK.md in the klar repository.
```
