module.exports = {
  moduleNameMapper: {
    // jest@25's resolver predates the package "exports" field, so it cannot
    // resolve OpenTelemetry's subpath export `@opentelemetry/otlp-exporter-base/node-http`
    // (reached transitively through the logger). Map it to the concrete build file so
    // any suite importing the logger chain can load under the 6.x toolchain.
    '^@opentelemetry/otlp-exporter-base/node-http$':
      '<rootDir>/node_modules/@opentelemetry/otlp-exporter-base/build/src/index-node-http.js',
  },
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(.*(test|spec)).tsx?$',
  testEnvironment: 'node',
}
