// See node-perf-hooks.js: the same `node:` prefix workaround for jest 25, and the
// same reason the require below uses the unprefixed name.
module.exports = require('v8') // NOSONAR
