# Security

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories on this
repository ("Report a vulnerability"), rather than opening a public issue. We aim
to acknowledge reports within a few days.

## Plugin trust model

klar's contrast algorithms can be extended with plugins — npm packages named
`klar-plugin-*` that klar loads and runs (see [PLUGINS.md](./PLUGINS.md)). This
section describes the security properties of that system so you can make an
informed decision before installing a plugin.

### The core fact: installing a plugin runs its code

A klar plugin is ordinary npm package code. **Installing one means trusting and
executing that code** — the same trust you extend to any npm dependency. A
package can run code at install time (`postinstall`) and at runtime (klar
`require()`s it to use it). No CLI can make untrusted package code safe to
install; treat plugins like any other dependency you add to a project.

What klar *does* guarantee is that it will not execute plugin code **beyond what
you explicitly installed**, and that it makes the trust decision visible and
controllable.

### Where klar loads plugins from

Discovery is scoped to two trusted sources only — klar does **not** walk
arbitrarily up the directory tree:

1. **Your project's declared dependencies.** klar reads the nearest
   `package.json` (from your working directory) and loads only `klar-plugin-*`
   packages listed in its `dependencies` / `devDependencies` /
   `optionalDependencies`. Transitive dependencies and unrelated parent projects
   are **not** auto-loaded.
2. **Packages installed alongside klar itself** (e.g. `npm install -g klar-cli
   klar-plugin-foo`). This covers global installs and is skipped when it would be
   your project's own `node_modules` (source 1 already covers that).

This means a `klar-plugin-*` package that merely happens to exist somewhere on
your machine — pulled in transitively, or installed for a different tool in a
parent folder — is **not** loaded by klar.

### Inspecting what is loaded

```bash
klar plugins list
```

shows every loaded plugin with its package name, version, resolved path, and
whether it came from your `[project]` or from a `[global]` install. Plugins
loaded from outside your project are explicitly flagged. Review this if you are
unsure what is active.

### Hardening controls (opt-out)

By default klar loads all plugins it discovers (convenient). You can tighten
this:

| Control | Effect |
|---|---|
| `klar --no-plugins …` | Disable plugin discovery for this invocation; run core algorithms only. |
| `KLAR_NO_PLUGINS=1` | Same, via environment (useful in CI). |
| `KLAR_PLUGINS=pkg-a,pkg-b` | **Allowlist.** Load only the named packages; everything else is ignored. The allowlist is checked *before* a package's code runs. |
| `package.json` → `"klar": { "plugins": ["pkg-a"] }` | Project-committed allowlist (same effect; `KLAR_PLUGINS` overrides it). |

Allowlist entries are **package names** (e.g. `klar-plugin-cvd-brettel`), so they
gate execution, not just visibility.

### General supply-chain hygiene

These apply to klar plugins as to any npm dependency:

- Pin versions and commit a lockfile; install with `npm ci`.
- Prefer packages published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements).
- Consider `npm install --ignore-scripts` to block install-time scripts (note:
  this does not stop a package's *runtime* code — use the klar allowlist for
  that).
- Audit dependencies with tooling such as `npm audit`, Socket, or Snyk.
