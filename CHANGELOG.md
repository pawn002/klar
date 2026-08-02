# Changelog

All notable changes to `klar-cli` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`@pawn002/klar-plugin-interface` and `@pawn002/klar-plugin-registry` are versioned
independently from `klar-cli`; entries below note when they move.

## [3.0.0] - 2026-08-02

Issue [#9] reported that `contrast` overstated out-of-gamut colors. It turned out
to be one of three instances of the same pattern — a plausible value, no signal,
and the error always running in the permissive direction. All three are fixed.

### Breaking

- **An out-of-gamut input now exits `1` on `contrast`** ([#9]). A color outside
  sRGB has to be resolved to a displayable one before it can be measured, so the
  number describes that mapped equivalent, not the color in your token file. That
  is a real answer to a different question, so the exit code stops it being
  adopted silently while stdout keeps the value for inspection. Waive per call
  with `--allow-out-of-gamut`. **This is the largest migration item**: an existing
  script measuring OKLCH tokens gets `1` where it got `0`, and under `set -e` that
  aborts rather than degrades.

  There is deliberately no environment variable for the waiver. `KLAR_GAMUT_MAP`
  configures the mapping, but nothing in the environment can silence the signal —
  a global mute gets set once in CI and never removed.

- **New flag `--gamut-map`, defaulting to CSS Color 4 mapping.** klar
  takes no position on what any particular browser does; tracking engines would
  mean maintaining an engine-and-version matrix indefinitely. The spec is a stable
  reference and an implementation is not. `clip` remains available as a
  well-defined channel clamp. No `--gamut <space>` flag ships, so `--gamut p3`
  stays purely additive whenever wide-gamut work lands ([#10]).

- **`--type` no longer changes the gamut policy.** `wcag2` and `deltaE` scored raw
  unmapped coordinates while `okca` scored a chroma-reduced color, so the
  algorithm silently determined the policy as well. It is now applied once at the
  input boundary. `wcag2` on an out-of-gamut pair moves `9.2` → `7.4`.

- **`okca` is scored via `oklch()` at full precision** instead of through an 8-bit
  hex round-trip, closing a disagreement with the continuous algorithms about
  which color was being measured. **Figures move by exactly 0.1 — never more —
  and toward accuracy**, since the figure now scores the color that was written
  down rather than its 8-bit rounding. Colors authored as hex are unaffected.

  *How often* depends on how the tokens were authored, and the range is wide:
  a synthetic sweep of random OKLCH coordinates moved 6.5%, but a real design
  system whose values are hand-authored round numbers (`oklch(0.27 0.06 245.34)`)
  moved **47% of 216 pairings**. Deliberately-chosen OKLCH values essentially
  never land on the 8-bit sRGB grid, so assume most of your recorded figures
  shift by 0.1.

  Reassuringly, on that same real token set the shift produced **zero pass/fail
  verdict changes** against recorded minimum floors. The drift is real but did
  not cross a threshold.

  It also means `--gamut-map css` reproduces 2.x's *mapping* but not always its
  *figure*.

- **`find` may now return a color with reduced chroma**, when the reference is not
  displayable as authored — normalization is mandatory, since otherwise there is
  no renderable color to return. Read `axesAdjusted` and `gamut` to see what
  moved. Targets that previously failed may now succeed.

- **`lightness` exits `1` with `null` bounds** when the color's chroma is not
  renderable at any lightness.

- **Removed** `ColorUtilService.getRgb255Array` and
  `ColorMetricsService.calculateOKCA`, both unreferenced.

### Added

- `--allow-out-of-gamut` on `contrast`, and `--allow-desaturation` on `find`.
- `KLAR_GAMUT_MAP` environment variable, matching the existing `KLAR_PLUGINS` /
  `KLAR_NO_PLUGINS` convention. Useful for pinning behavior during migration.
- **`reason` on `find`** — a machine-readable enum (`ok`, `lightness-exhausted`,
  `unreachable`, `chroma-exhausted`) so nothing has to parse prose. `message`
  remains human-readable and its wording is not stable. `unreachable` is decided
  against the contrast ceiling for the base color, making it a claim about colors
  rather than about klar's effort.
- **`resolvableBy` on `find`** — when lightness alone falls short, the chroma and
  lightness that *would* reach the target, and the ΔE it costs, reported without
  being applied. Trading brand saturation for contrast is a design decision, and
  an agent accepting a desaturated brand color silently produces drift no single
  call reveals. `--allow-desaturation` records that a human has made the call.
- `axesAdjusted` and `deltaE` on `find`. Gamut normalization is never listed as an
  adjusted axis — it is reported under `gamut`, and it was not something the
  caller chose to trade.
- `gamut` object in `contrast`, `find` and `lightness` `--json` output.
- Out-of-gamut notes on **stderr** for `contrast`, `find` and `variants`, so `-q`
  keeps a bare, composable value on stdout.

### Fixed

- **The contrast swatch and the contrast number disagreed.** One line of
  `klar contrast` output rendered one color and reported a number computed on
  another. klar had two unrelated gamut conversions; the correct-looking one
  existed only incidentally, as escape-sequence range-guarding in the ANSI swatch.
- **`find` could return the reference color unchanged and unrenderable.** When the
  authored chroma was out of gamut at every lightness, no candidate passed the
  gamut check, the fallback meant to prevent exactly this stayed null, and the
  input came back marked as the closest result. Normalization now runs first, so
  the failure is structurally impossible.
- **`find` could report a target unreachable that the reference already met.** The
  lightness bisection could converge without ever evaluating the reference's own
  lightness, which for a saturated hue is often the only place its chroma renders.
- **`lightness` invented a range when none existed.** `oklch(0.5 0.9 25)` renders
  at no lightness, but the command returned `{lightMin: 0.5, lightMax: 0.5}` — "the
  usable range is exactly 0.5" — at exit 0.
- **Achromatic colors returned `null` from okca** on the new `oklch()` path, since
  grays convert to a `NaN` hue and a chroma that serializes to exponent notation.
  Every neutral in a design system would have hit it.
- **Coordinates could be boxed `Number` objects.** colorjs.io returns them for
  bare-number CSS coordinates, and they defeat `Number.isFinite` and strict
  equality while behaving normally under arithmetic and `JSON.stringify`.
  Normalized at the boundary via `numericCoords`.
- `AlgorithmDomainError` replaces `GamutNotRepresentableError`. The old message
  claimed hex cannot represent an out-of-gamut color, which is false — okca
  accepts `oklch()`. The real limit is that okca's guarantee is established across
  the sRGB gamut.

### Changed

- Test suite split into two jest projects. Most specs run against a simplified
  `colorjs.io` mock whose color math is approximate — which is why no existing
  test could have caught any of this. Specs named `*.real.spec.ts` resolve the
  real library and pin concrete values.
- Colors klar *produces* (`find`, `match`, `pair`, `createSrgbColor`) now use the
  CSS Color 4 mapping rather than plain `oklch.c`, so one algorithm applies
  everywhere klar maps a color.

### Migration

1. `contrast` on OKLCH-authored tokens may now exit `1`. Audit with
   `--json` and read `gamut.outOfGamut`, then either fix the tokens or pass
   `--allow-out-of-gamut`.

   **Expect this to fire often.** On a real OKLCH-authored design system, 29% of
   distinct color tokens and 21% of measured pairings were outside sRGB —
   including subtle ones like `oklch(0.97 0.02 278.14)`, since the gamut narrows
   to a point at both lightness extremes and low chroma is no protection.

   **Under `set -e` this aborts the script at the first such token**, leaving a
   partial result on stdout that reads like a complete short run. Guard the
   assignment: `if OKCA=$(klar contrast "$T" "$BG" -q); then … else … fi`.

   **Node's `execSync` throws on a non-zero exit** in the same way, and the value
   is stranded in `err.stdout`. If you shell out from JS, catch it:

   ```js
   let out;
   try { out = execSync(cmd, { encoding: 'utf8' }); }
   catch (e) { out = e.stdout; outOfGamut = true; }   // exit 1 still produced a value
   ```

   Colors klar produces (`variants`, `find`, `match`) are in gamut by
   construction and are unaffected.
2. Expect OKLCH-authored figures to move by exactly 0.1 — 47% of pairings on a
   real token set. Re-baseline recorded values rather than treating the
   difference as a regression.
3. If a pipeline branches on `find` failures, switch from parsing `message` to
   reading `reason`.

## [2.0.0] - 2026-07-27

### Breaking

- **Contrast scores changed** — `@pawn002/okca` upgraded from `^1.0.1` to `^2.0.2`.
  okca 2.0 recalibrated its constants (`CHROMA_K`, `POL_K`, `LOD_CAP`, `DOL_CAP`),
  so the same colors score differently than under klar 1.x: the light-on-dark cap
  moved 21 → 20.9 (dark-on-light stays 20), and mid-range values shifted — white on
  `#767676` went from ~3.5 to ~3.9. **A pair that cleared a threshold under 1.0.1 may
  not under 2.0.0, and vice versa.** Re-validate any design tokens checked against
  klar 1.x output before upgrading. The FP=0 guarantee now holds by construction
  rather than by sampling; see okca's
  [`FP0_PROOF.md`](https://github.com/pawn002/okca/blob/main/docs/FP0_PROOF.md).
- **`klar pair --min-lightness` and `--max-lightness` removed.** They were parsed but
  never constrained the output, so passing them was already a no-op. They now exit 2
  as unknown options instead of being silently ignored.
- **Usage errors exit 2 instead of 1.** commander's parse errors — unknown option,
  unknown command, missing argument, missing required option — previously exited 1,
  the same code klar uses for *soft failure*. That made `klar find --targt 4.5`
  indistinguishable from "no color meets the target" to a script branching on `$?`.
  They now exit 2, matching the contract in `utils/output.ts`. `--help` and
  `--version` still exit 0.

### Fixed

- `klar match` reported the wrong chroma. `color1` is rebuilt at `color2`'s chroma,
  so `color2`'s chroma is the shared value, but the command echoed `color1`'s
  *original* chroma — which was `0` whenever `color1` was neutral — while both
  returned colors carried the corrected value.
- Color swatches rendered incorrectly for hex input that wasn't 6 digits.
- Each command's own `--help` output was wrong in several places, including
  `find`'s examples (which used targets that are unreachable and exit 1) and
  `variants`' description of what `--min-delta` actually constrains.

### Changed

- `variants` help now documents that fixed-step mode is **not** gamut-aware:
  out-of-gamut cells come back as `"color": ""` and are often the majority
  (`--light-steps 10 --chroma-steps 5` on a saturated blue yields 50 cells, 36 empty).
  Adaptive mode remains the gamut-aware default.
- `find` help now states that only lightness is adjusted — chroma and hue are
  preserved — so saturated colors have a narrow reachable band, and the closest
  result is still printed on exit 1.
- `AGENT_PLAYBOOK.md` and `README.md` corrected throughout: okca claims, the stderr
  behavior of bare `klar`, and several verified defects in the playbook's examples.

### Removed

- The `lint` script. It had never worked — `eslint` was never a dependency and no
  eslint config had existed on any branch since the initial commit — and no workflow
  or doc referenced it. Setting up real linting is tracked in
  [#8](https://github.com/pawn002/klar/issues/8).

### Notes

`@pawn002/klar-plugin-interface` and `@pawn002/klar-plugin-registry` are unchanged and
remain at **1.0.1**. The plugin API did not break; only `klar-cli` goes to 2.0.0.

## [1.0.1] - 2026-06-10

### Changed

- Version bump only, no functional changes. First release published through the
  CI/OIDC trusted-publishing pipeline, with npm provenance attestation.
- `klar-cli`, `@pawn002/klar-plugin-interface`, and `@pawn002/klar-plugin-registry`
  all bumped to 1.0.1 together.

## [1.0.0] - 2026-06-10

Initial release.

### Added

- `klar` CLI with the `contrast`, `pair`, `match`, `variants`, `find`, and `plugins`
  commands, plus the OKCA contrast algorithm alongside `wcag2` and `deltaE`.
- Plugin system with a published interface and registry, and support for
  third-party contrast-algorithm plugins.
- `AGENT_PLAYBOOK.md` for AI coding agents, `PLUGINS.md`, and `SECURITY.md`.
- CI across Node 18/20/22, plus OIDC trusted-publishing and draft-release workflows.
- `scripts/prepare-publish.mjs`, which flips internal `file:` deps to real version
  ranges at publish time so the committed tree can stay on `file:` links for local dev.

### Security

- Plugin discovery hardened against supply-chain exposure ([#2]). Plugin loading is
  scoped to what the user explicitly installed — the host project's declared
  dependencies and packages co-installed alongside klar — replacing a blind upward
  `node_modules` walk with no transitive auto-loading. Adds a `--no-plugins` /
  `KLAR_NO_PLUGINS` kill switch and a package-name allowlist (`KLAR_PLUGINS` or
  `package.json` `"klar.plugins"`), both gated before any package code runs.
  `klar plugins list` now surfaces each plugin's source, version, and resolved path,
  and flags plugins loaded from outside the project.

[3.0.0]: https://github.com/pawn002/klar/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/pawn002/klar/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/pawn002/klar/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/pawn002/klar/releases/tag/v1.0.0
[#2]: https://github.com/pawn002/klar/pull/2
[#9]: https://github.com/pawn002/klar/issues/9
[#10]: https://github.com/pawn002/klar/issues/10
