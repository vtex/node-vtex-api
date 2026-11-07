// Run after building: node scripts/benchmark-response-sanitizer.js
// Clean JSON fast path only. Excludes allocation, serialization, HTTP and compression.
const assert = require('node:assert')
const os = require('node:os')
const { performance } = require('node:perf_hooks')
const { scanForErrors } = require('../lib/utils/responseSanitizer')
const { sanitizeCredentials } = require('../lib/utils/responseCredentials')
const secrets = ['fake-context-token-01234567890123456789']
const cases = [
  ['1 MiB string', { text: 'a'.repeat(1024 * 1024) }],
  ['8 MiB string', { text: 'a'.repeat(8 * 1024 * 1024) }],
  ['15 MiB string', { text: 'a'.repeat(15 * 1024 * 1024) }],
  ['20000 rows', { data: Array.from({ length: 20000 }, (_, id) => ({ id, title: 'ordinary product', description: 'product description '.repeat(20) })) }],
]
const measure = fn => {
  for (let i = 0; i < 5; i++) fn()
  const times = []
  for (let i = 0; i < 20; i++) {
    const start = performance.now()
    fn()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return { p50ms: +times[9].toFixed(3), p95ms: +times[18].toFixed(3) }
}
console.log(JSON.stringify({ node: process.version, cpu: os.cpus()[0].model, samples: 20, warmup: 5 }))
for (const [name, body] of cases) {
  assert.strictEqual(scanForErrors(body), 'clean')
  const result = sanitizeCredentials(body, secrets)
  assert.strictEqual(result.value, body)
  assert.strictEqual(result.redacted, 0)
  assert.strictEqual(result.truncated, false)
  const baseline = measure(() => scanForErrors(body))
  const proposed = measure(() => { scanForErrors(body); sanitizeCredentials(body, secrets) })
  console.log(JSON.stringify({ name, bytes: Buffer.byteLength(JSON.stringify(body)), baseline, proposed }))
}
