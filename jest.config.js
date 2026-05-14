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
    '^@opentelemetry/otlp-exporter-base/node-http$':
      '<rootDir>/node_modules/@opentelemetry/otlp-exporter-base/build/src/index-node-http.js',
    '^@opentelemetry/otlp-exporter-base/browser-http$':
      '<rootDir>/node_modules/@opentelemetry/otlp-exporter-base/build/src/index-browser-http.js',
  },
}
