module.exports = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(.*(test|spec)).tsx?$',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@vtex/diagnostics-semconv$': '<rootDir>/__mocks__/@vtex/diagnostics-semconv.ts',
    '^axios$': '<rootDir>/node_modules/axios/dist/node/axios.cjs',
    // Jest 25 predates the node: prefix, which the runtime instrumentation the metrics
    // client loads (via @vtex/diagnostics-nodejs) uses for core modules. A third
    // specifier would need its own line here.
    '^node:perf_hooks$': '<rootDir>/__mocks__/node-perf-hooks.js',
    '^node:v8$': '<rootDir>/__mocks__/node-v8.js',
    '^@opentelemetry/otlp-exporter-base/node-http$':
      '<rootDir>/node_modules/@opentelemetry/otlp-exporter-base/build/src/index-node-http.js',
    '^@opentelemetry/otlp-exporter-base/browser-http$':
      '<rootDir>/node_modules/@opentelemetry/otlp-exporter-base/build/src/index-browser-http.js',
  },
}
