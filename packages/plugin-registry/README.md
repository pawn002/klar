# @pawn002/klar-plugin-registry

The runtime registry [klar](https://github.com/pawn002/klar) uses to hold
contrast-algorithm plugins keyed by `id` — a dependency-free `PluginRegistry` class.

This is a **framework package**: klar-cli depends on it internally. If you're
*authoring* a plugin you don't need it — implement
[`@pawn002/klar-plugin-interface`](https://www.npmjs.com/package/@pawn002/klar-plugin-interface)
and klar does the registering. Install this directly only if you're embedding klar's
plugin machinery in your own tool.

## Install

```bash
npm install @pawn002/klar-plugin-registry
```

## API

```ts
import { PluginRegistry } from '@pawn002/klar-plugin-registry';
import type { ContrastPlugin } from '@pawn002/klar-plugin-registry';

const registry = new PluginRegistry();
registry.register(myPlugin);   // chainable; a later id overwrites an earlier one
registry.get('mymetric');      // ContrastPlugin | undefined
registry.has('mymetric');      // boolean
registry.list();               // ContrastPlugin[] (insertion order)
registry.ids();                // string[] (insertion order)
```

| Method | Returns | Notes |
|---|---|---|
| `register(plugin)` | `this` | Chainable. A later registration with the same `id` overrides an earlier one. |
| `get(id)` | `ContrastPlugin \| undefined` | |
| `has(id)` | `boolean` | |
| `list()` | `ContrastPlugin[]` | Insertion order. |
| `ids()` | `string[]` | Insertion order. |

The `ContrastPlugin` type is re-exported for convenience.

## License

MIT
