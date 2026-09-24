module.exports = {
  moduleNameMapper: {
    // jest@25's resolver predates the package "exports" field, so it cannot load the
    // modern @vtex/diagnostics-nodejs + OpenTelemetry logger chain that src/service/logger
    // pulls in at module-eval time (reached transitively by nearly every service module).
    // Stub the package so any suite importing the logger chain can load under the 6.x
    // toolchain; the real telemetry/log-client paths are lazy and error-guarded, so this
    // has no behavioural effect on the code under test. See jest/stubs/diagnosticsNodejs.js.
    '^@vtex/diagnostics-nodejs$': '<rootDir>/jest/stubs/diagnosticsNodejs.js',
    // Belt-and-braces for the same chain if it is reached directly rather than through
    // the stub above.
    '^@opentelemetry/otlp-exporter-base/node-http$':
      '<rootDir>/node_modules/@opentelemetry/otlp-exporter-base/build/src/index-node-http.js',
    // axios's "main" field points at its ESM entry; jest@25 predates the "exports" field
    // that real Node/bundlers use to pick the CJS build instead, so it fails to parse the
    // `import` statement in that ESM entry. Map straight to the CJS build.
    '^axios$': '<rootDir>/node_modules/axios/dist/node/axios.cjs',
  },
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(.*(test|spec)).tsx?$',
  testEnvironment: 'node',
}
