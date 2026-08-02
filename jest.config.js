// Test configuration. Dev-only — not part of the published package
// (package.json `files` ships only `dist`).
//
// Two projects, because most specs run against a simplified colorjs.io mock
// (`__mocks__/colorjs.io.ts`) whose color math is approximate. That is fine for
// exercising control flow, but it means no mocked spec can validate an actual
// color value — which is why the out-of-gamut contrast defect in issue #9
// shipped with a green suite. Specs named `*.real.spec.ts` resolve the real
// library so they can pin concrete values against what a browser paints.
const baseConfig = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  transform: {
    '^.+\\.(ts|js)$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'ES2021',
          skipLibCheck: true,
          esModuleInterop: true,
          allowJs: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
  testEnvironment: 'node',
};

module.exports = {
  projects: [
    {
      ...baseConfig,
      displayName: 'unit',
      testRegex: '.*\\.spec\\.ts$',
      testPathIgnorePatterns: ['\\.real\\.spec\\.ts$'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^colorjs\\.io$': '<rootDir>/../__mocks__/colorjs.io.ts',
      },
    },
    {
      ...baseConfig,
      displayName: 'color',
      testRegex: '.*\\.real\\.spec\\.ts$',
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
    },
  ],
};
