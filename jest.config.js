module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/.env'], // Load environment variables
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)'
  ],
  verbose: true,
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ],
  testTimeout: 10000, // 10 seconds timeout for tests
  globals: {
    'ts-jest': {
      diagnostics: false
    }
  }
};