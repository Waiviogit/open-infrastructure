module.exports = {
  displayName: 'query-api-e2e',
  preset: '../../jest.preset.js',
  testTimeout: 20_000,
  // Specs share one server and one database: run them one at a time.
  maxWorkers: 1,
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  globalTeardown: '<rootDir>/src/support/global-teardown.ts',
  setupFiles: ['<rootDir>/src/support/test-setup.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/query-api-e2e',
};
