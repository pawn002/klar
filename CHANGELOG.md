# Changelog

All notable changes to `klar-cli` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`@pawn002/klar-plugin-interface` and `@pawn002/klar-plugin-registry` are versioned
independently from `klar-cli`; entries below note when they move.

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

[2.0.0]: https://github.com/pawn002/klar/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/pawn002/klar/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/pawn002/klar/releases/tag/v1.0.0
[#2]: https://github.com/pawn002/klar/pull/2
