// Jest 25 predates the `node:` prefix, so jest.config.js maps that specifier here.
// The unprefixed require is deliberate: the prefixed form would map back onto this file.
module.exports = require('perf_hooks') // NOSONAR
