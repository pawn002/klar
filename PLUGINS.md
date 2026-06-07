# klar Plugins

`klar` ships with built-in contrast algorithms (`okca`, `wcag2`, `deltaE`).
Additional contrast algorithms are provided as **optional, separately-installed
plugins**.

## How plugins work

A plugin is an npm package named `klar-plugin-<id>` that exports an object
implementing the `ContrastPlugin` interface from
[`@pawn002/klar-plugin-interface`](https://www.npmjs.com/package/@pawn002/klar-plugin-interface).

At startup, `klar` registers `klar-plugin-*` packages it finds, scoped to what
you explicitly installed: packages declared in your project's `package.json`
dependencies, plus packages installed alongside klar itself (e.g. a global
install). It does **not** walk arbitrarily up the directory tree or auto-load
transitive dependencies. The core CLI does not bundle or depend on any algorithm
plugin — each is installed explicitly by the user. If no plugins are installed,
`klar` runs on its built-in algorithms alone.

Because loading a plugin runs its code, discovery can be inspected and locked
down — `klar plugins list` shows where each plugin was loaded from, and
`--no-plugins`, `KLAR_PLUGINS`, and `package.json` `"klar": { "plugins": [...] }`
control what loads. See [SECURITY.md](./SECURITY.md) for the full trust model.

## Licensing — read before installing

> **Each plugin is maintained and licensed independently of klar-cli.** klar-cli
> is MIT-licensed, but a plugin may wrap an algorithm published under different
> terms. Installing a plugin means accepting that plugin's license and the
> license of any algorithm it depends on. Review each plugin's own page and
> license before installing. klar-cli makes no representation about the
> licensing, accuracy, or fitness of third-party plugins.

## Installing a plugin

```bash
npm install -g klar-plugin-<id>
# the new algorithm is then available:
klar contrast "#fff" "#000" --type <id>
```

To see which plugins are active in your environment:

```bash
klar plugins list
```

## Available plugins

Contrast-algorithm plugins are published under the `klar-plugin-*` convention.
Search npm for [`klar-plugin`](https://www.npmjs.com/search?q=klar-plugin) to
find available packages. Each package's own README documents what it does, who
maintains it, its attribution, and its license terms.

*(First-party algorithm plugins are published separately from klar-cli; links
will be listed here as they become available. Until then, each plugin's npm
page and repository are the authoritative source for its details and license.)*

## Authoring a plugin

1. Implement the `ContrastPlugin` interface:

   ```ts
   import type { ContrastPlugin } from '@pawn002/klar-plugin-interface';

   export const MyPlugin: ContrastPlugin = {
     id: 'mymetric',
     displayName: 'My Metric',
     description: 'One-sentence description of the algorithm and its range.',
     // unit?: 'px',                 // optional, for dimension-type results
     // category?: 'contrast',       // 'contrast' (default) | 'dimension'
     calculate(colorOne: string, colorTwo: string): number | null {
       // return a number, or null if the input can't be handled
       return 0;
     },
   };

   export default MyPlugin;
   ```

2. Publish a package named `klar-plugin-mymetric` with `MyPlugin` as an export.
   Declare `@pawn002/klar-plugin-interface` as a dependency (or peer dependency).

3. Users who `npm install klar-plugin-mymetric` will have `--type mymetric`
   available automatically — no registration in klar-cli required.

Document your plugin's license and any third-party algorithm attribution in its
own README. The core references no specific algorithm plugin — each plugin owns
its own naming and notices.
