module.exports = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(.*(test|spec)).tsx?$',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@vtex/diagnostics-semconv$': '<rootDir>/__mocks__/@vtex/diagnostics-semconv.ts',
  },
}
