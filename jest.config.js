module.exports = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  testMatch: [
    '**/__tests__/**/*.(js|ts)?(x)',
    '**/?(*.)+(spec|test).(js|ts)?(x)'
  ],
  testPathIgnorePatterns: [
    '.*Test[A-Z].*\\.ts$'
  ],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@vtex/diagnostics-semconv$': '<rootDir>/__mocks__/@vtex/diagnostics-semconv.ts',
  },
  moduleFileExtensions: [
    'ts',
    'js'
  ],
  extensionsToTreatAsEsm: ['.ts'],
}