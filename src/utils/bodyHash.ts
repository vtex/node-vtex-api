import { createHash } from 'crypto' // NOSONAR: `node:crypto` types aren't available with the `@types/node@12.x` pinned in this repo

// Object keys from `Object.entries` are always distinct, so `ka` and `kb` are never equal here.
const compareKeys = ([ka]: [string, unknown], [kb]: [string, unknown]) => (ka < kb ? -1 : 1)

const deterministicReplacer = (_: any, v: any) => {
  return typeof v !== 'object' || v === null || Array.isArray(v) ? v :
    Object.fromEntries(Object.entries(v).sort(compareKeys))
}

export function computeBodyHash(data: any, onSerializeError?: () => void): string {
  if (Buffer.isBuffer(data)) {
    // MD5 here only derives a cache-key digest for the request body, not a security-sensitive
    // value - no secret protection or tamper-integrity guarantee is being made.
    return createHash('md5').update(data).digest('hex') // NOSONAR
  }

  const replacer = (key: string, value: any) => {
    try {
      return deterministicReplacer(key, value)
    }
    catch {
      // I don't believe this will ever happen, but just in case
      // Also, I didn't include error as I am unsure if it would have sensitive information
      onSerializeError?.()
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
    // already caught), or `data` itself serializing to `undefined` (e.g. data === undefined).
    // Fall back to a representation that never throws.
    onSerializeError?.()
    return createHash('md5').update(String(data)).digest('hex') // NOSONAR
  }
}
