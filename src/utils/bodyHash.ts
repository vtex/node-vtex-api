import { createHash, randomBytes } from 'crypto' // NOSONAR: `node:crypto` types aren't available with the `@types/node@12.x` pinned in this repo

// Object keys from `Object.entries` are always distinct, so `ka` and `kb` are never equal here.
const compareKeys = ([ka]: [string, unknown], [kb]: [string, unknown]) => (ka < kb ? -1 : 1)

const deterministicReplacer = (_: any, v: any) => {
  return typeof v !== 'object' || v === null || Array.isArray(v) ? v :
    Object.fromEntries(Object.entries(v).sort(compareKeys))
}

export function computeBodyHash(data: any, onSerializeError?: () => void): string {
  if (ArrayBuffer.isView(data)) {
    // MD5 here only derives a cache-key digest for the request body, not a security-sensitive
    // value - no secret protection or tamper-integrity guarantee is being made.
    // Cast needed: the `@types/node@12.x` pinned in this repo types `Hash.update` against a
    // narrower `BinaryLike` than the `ArrayBufferView` the `ArrayBuffer.isView` guard produces,
    // even though every ArrayBufferView (Buffer, TypedArray, DataView) is accepted at runtime.
    return createHash('md5').update(data as Buffer).digest('hex') // NOSONAR
  }

  if (data === undefined) {
    // getWithBody's `data` is optional, so an omitted body is a normal, deterministic case -
    // not a serialization failure. It must hash to a fixed value, or callers that omit the
    // body would get a different bodyHash (and cache-key) on every single request, permanently
    // defeating the cache rather than the "one-time miss" the randomBytes fallback below allows.
    return createHash('md5').update('undefined').digest('hex') // NOSONAR
  }

  // Reports at most once per call, even if both the replacer and the outer JSON.stringify
  // catch below end up hitting it for the same underlying failure.
  let hasReportedSerializeError = false
  const reportSerializeError = () => {
    if (!hasReportedSerializeError) {
      hasReportedSerializeError = true
      onSerializeError?.()
    }
  }

  const replacer = (key: string, value: any) => {
    try {
      return deterministicReplacer(key, value)
    }
    catch {
      // I don't believe this will ever happen, but just in case
      // Also, I didn't include error as I am unsure if it would have sensitive information
      reportSerializeError()
      return value
    }
  }

  try {
    // MD5 here only derives a cache-key digest for the request body, not a security-sensitive
    // value - no secret protection or tamper-integrity guarantee is being made.
    return createHash('md5').update(JSON.stringify(data, replacer)).digest('hex') // NOSONAR
  }
  catch {
    // JSON.stringify can still fail (or return undefined) even after the replacer recovers -
    // e.g. a property whose getter fails on every access (not just the one the replacer
    // already caught), a circular reference, or `data` itself serializing to `undefined`
    // (e.g. data === undefined). A constant fallback (e.g. String(data)) would collapse
    // any two different bodies that hit this path into the same bodyHash - a cache-key
    // collision, not just a miss. Use random bytes instead: every call gets a unique key,
    // so this path can only ever cause a cache miss, never serve the wrong content.
    reportSerializeError()
    return randomBytes(16).toString('hex')
  }
}
