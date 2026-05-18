module.exports = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(.*(test|spec)).tsx?$',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Phase 2 (T011) will move __mocks__ into this package; until then,
    // resolve the mock from the repo root so existing tests keep working
    // after migration.
    '^@vtex/diagnostics-semconv$':
      '<rootDir>/__mocks__/@vtex/diagnostics-semconv.ts',
  },
}
