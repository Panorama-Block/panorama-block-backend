module.exports = {
  ...require('./jest.config.js'),
  testMatch: [
    '**/tests/e2e/**/*.test.ts',
    '**/tests/e2e/**/*.spec.ts'
  ],
  testTimeout: 300000, // 5 minutes for E2E tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/e2e/setup.ts'
  ],
  globalSetup: '<rootDir>/tests/e2e/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/e2e/globalTeardown.ts',
  maxWorkers: 1, // Run E2E tests sequentially
  bail: 1 // Stop on first failure
};