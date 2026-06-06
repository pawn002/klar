// Test configuration. Dev-only — not part of the published package
// (package.json `files` ships only `dist`).
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
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
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^colorjs\\.io$': '<rootDir>/../__mocks__/colorjs.io.ts',
  },
  testEnvironment: 'node',
};
