// Jest 25 resolves core modules from a list that predates the `node:` prefix, so a
// `require('node:perf_hooks')` inside a dependency is looked up as a file path. The
// runtime instrumentation the metrics client loads is the only place that does it;
// this shim is what jest.config.js points that specifier at.
//
// The unprefixed specifier below is the whole point and is not a style slip: jest
// maps `node:perf_hooks` to this file, so requiring the prefixed form here would map
// back onto itself and resolve to a half-initialised module.
module.exports = require('perf_hooks') // NOSONAR
