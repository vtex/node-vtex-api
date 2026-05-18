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
    // axios 1.x and @opentelemetry/otlp-exporter-base ship ESM at
    // their package 'main' / subpath exports. Jest 25 doesn't honor
    // 'exports' fields, so pin the CJS bundles explicitly. Resolves
    // from the hoisted root node_modules (Yarn 1 workspaces).
    // Ported forward from master commit e3b6ad58 (not present on this
    // feature branch's base; introduced 'fix(test): unblock jest test
    // runner so SonarQube can consume coverage').
    '^axios$':
      '<rootDir>/../../node_modules/axios/dist/node/axios.cjs',
    '^@opentelemetry/otlp-exporter-base/node-http$':
      '<rootDir>/../../node_modules/@opentelemetry/otlp-exporter-base/build/src/index-node-http.js',
    '^@opentelemetry/otlp-exporter-base/browser-http$':
      '<rootDir>/../../node_modules/@opentelemetry/otlp-exporter-base/build/src/index-browser-http.js',
  },
}
