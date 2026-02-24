module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    'lib/**/*.js',
    '!**/node_modules/**',
  ],
  coverageReporters: ['text', 'html', 'json-summary'],
};
