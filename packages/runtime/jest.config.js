module.exports = {
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(.*(test|spec)).tsx?$',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@vtex/diagnostics-semconv$':
      '<rootDir>/__mocks__/@vtex/diagnostics-semconv.ts',
    // Mirror lib's mapper (e3b6ad58 forward-port). Jest 25 doesn't honor
    // 'exports' fields, so resolve via root node_modules (Yarn 1 hoist).
    '^axios$':
      '<rootDir>/../../node_modules/axios/dist/node/axios.cjs',
    '^@opentelemetry/otlp-exporter-base/node-http$':
      '<rootDir>/../../node_modules/@opentelemetry/otlp-exporter-base/build/src/index-node-http.js',
    '^@opentelemetry/otlp-exporter-base/browser-http$':
      '<rootDir>/../../node_modules/@opentelemetry/otlp-exporter-base/build/src/index-browser-http.js',
    // Phase 3 (T024) moved http middleware tests from lib to runtime. The
    // tests' source-relative imports (e.g. '../../../../../errors',
    // '../../typings') previously resolved within packages/lib/src;
    // automated rewriter forwards them to '@vtex/api' via the tsconfig
    // path alias. No manual mapping needed here for the test sources.
  },
}
