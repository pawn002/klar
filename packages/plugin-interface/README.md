# @pawn002/klar-plugin-interface

The shared TypeScript contract every [klar](https://github.com/pawn002/klar)
contrast-algorithm plugin implements: the `ContrastPlugin` interface.

This package is **types only** — it ships an interface and no runtime code. A plugin
declares it as a types-only `devDependency`; the compiled JavaScript has no runtime
dependency on it.

## Install

```bash
npm install --save-dev @pawn002/klar-plugin-interface
```

## The contract

```ts
import type { ContrastPlugin } from '@pawn002/klar-plugin-interface';

export const MyMetric: ContrastPlugin = {
  id: 'mymetric',            // unique; becomes --type <id> in the CLI
  displayName: 'My Metric',  // shown by `klar plugins list`
  description: 'One line on what it measures and its range.',
  // unit?: 'px',            // optional; for category 'dimension'
  // category?: 'contrast',  // 'contrast' (default) | 'dimension'
  calculate(colorOne, colorTwo) {
    // colorOne/colorTwo are CSS color strings (hex, rgb(), oklch(), …)
    // return a number, or null if the input can't be handled
    return 0;
  },
};

export default MyMetric;
```

| Member | Type | Notes |
|---|---|---|
| `id` | `string` | Unique, URL-safe; the `--type` value. Must not collide with built-ins (`okca`, `wcag2`, `deltaE`). |
| `displayName` | `string` | Human-readable name. |
| `description` | `string` | One-sentence summary (range, licensing notes). |
| `unit?` | `string` | Unit label (e.g. `'px'`); omit for dimensionless values. |
| `category?` | `'contrast' \| 'dimension'` | Defaults to `'contrast'`. |
| `calculate` | `(a, b) => number \| null` | Returns the value, or `null` on unparseable input — **return `null`, don't throw**. |

## How a plugin gets used

Publish a package named `klar-plugin-<id>` that exports a `ContrastPlugin`. klar
discovers installed `klar-plugin-*` packages by naming convention at runtime and
exposes each as `--type <id>` — no registration in klar itself.

Full architecture + authoring guide:
[`pawn002/klar-plugins`](https://github.com/pawn002/klar-plugins). Plugin trust model:
[klar `SECURITY.md`](https://github.com/pawn002/klar/blob/main/SECURITY.md).

## License

MIT
