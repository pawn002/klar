// Minimal reference plugin — the canonical shape klar discovers by the
// `klar-plugin-*` convention. It implements the ContrastPlugin interface from
// @pawn002/klar-plugin-interface. Used as a test fixture for discovery/routing;
// also serves as a copy-paste template for plugin authors (see PLUGINS.md).
//
// Its `calculate` returns a trivial, deterministic value — this fixture exists
// to prove the wiring (discovery -> registry -> routing), not to be a real
// contrast metric.

/** @type {import('@pawn002/klar-plugin-interface').ContrastPlugin} */
const ExamplePlugin = {
  id: 'example',
  displayName: 'Example Metric',
  description: 'Reference plugin fixture; returns a fixed value to exercise discovery.',
  calculate(colorOne, colorTwo) {
    if (typeof colorOne !== 'string' || typeof colorTwo !== 'string') return null;
    return 42;
  },
};

module.exports = ExamplePlugin;
module.exports.ExamplePlugin = ExamplePlugin;
module.exports.default = ExamplePlugin;
