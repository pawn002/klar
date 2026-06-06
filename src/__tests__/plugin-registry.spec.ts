import { PluginRegistry } from '@pawn002/klar-plugin-registry';
import type { ContrastPlugin } from '@pawn002/klar-plugin-interface';
import { getServices } from '../services';

// ---- helpers ---------------------------------------------------------------

function makePlugin(id: string, value = 42): ContrastPlugin {
  return {
    id,
    displayName: `Test plugin ${id}`,
    description: 'stub',
    calculate: () => value,
  };
}

// ---- PluginRegistry unit tests ---------------------------------------------

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('starts empty', () => {
    expect(registry.list()).toHaveLength(0);
    expect(registry.ids()).toHaveLength(0);
  });

  it('registers and retrieves a plugin by id', () => {
    const plugin = makePlugin('foo');
    registry.register(plugin);
    expect(registry.get('foo')).toBe(plugin);
  });

  it('returns undefined for an unregistered id', () => {
    expect(registry.get('missing')).toBeUndefined();
  });

  it('has() reflects registration state', () => {
    expect(registry.has('bar')).toBe(false);
    registry.register(makePlugin('bar'));
    expect(registry.has('bar')).toBe(true);
  });

  it('list() returns all plugins in insertion order', () => {
    const a = makePlugin('a');
    const b = makePlugin('b');
    registry.register(a).register(b);
    expect(registry.list()).toEqual([a, b]);
  });

  it('ids() returns ids in insertion order', () => {
    registry.register(makePlugin('x')).register(makePlugin('y'));
    expect(registry.ids()).toEqual(['x', 'y']);
  });

  it('later registration with same id overwrites earlier', () => {
    registry.register(makePlugin('dup', 1));
    registry.register(makePlugin('dup', 2));
    expect(registry.get('dup')!.calculate('', '')).toBe(2);
    expect(registry.ids()).toEqual(['dup']); // still only one entry
  });
});

// ---- getServices() discovery integration tests ----------------------------
// These exercise the `klar-plugin-*` discovery convention against a neutral
// fixture package (`klar-plugin-example`, a file: devDep). The core hardcodes
// no algorithm names; discovery finds whatever klar-plugin-* packages are
// installed. See src/services/index.ts and PLUGINS.md.

describe('getServices() plugin discovery', () => {
  it('discovers an installed klar-plugin-* package by convention', () => {
    const { pluginRegistry } = getServices();
    expect(pluginRegistry.has('example')).toBe(true);
  });

  it('registers the plugin the package exports', () => {
    const { pluginRegistry } = getServices();
    const plugin = pluginRegistry.get('example');
    expect(plugin).toBeDefined();
    expect(plugin!.id).toBe('example');
  });
});

// ---- ColorMetricsService + plugin lookup ----------------------------------

describe('ColorMetricsService plugin lookup', () => {
  it('routes a discovered plugin id and returns a finite number', () => {
    const { colorMetricsService } = getServices();
    const result = colorMetricsService.getContrast('#000000', '#ffffff', 'example');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
    expect(isFinite(result!)).toBe(true);
  });

  it('returns null for an unregistered type', () => {
    const { colorMetricsService } = getServices();
    const result = colorMetricsService.getContrast('#000000', '#ffffff', 'totally-unknown-type');
    expect(result).toBeNull();
  });
});
