// Jest 25 resolves core modules from a list that predates the `node:` prefix, so a
// `require('node:perf_hooks')` inside a dependency is looked up as a file path. The
// runtime instrumentation the metrics client loads is the only place that does it;
// this shim is what jest.config.js points that specifier at.
module.exports = require('perf_hooks')
