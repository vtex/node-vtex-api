import { createHash, randomBytes } from 'crypto' // NOSONAR: `node:crypto` types aren't available with the `@types/node@12.x` pinned in this repo

// Object keys from `Object.entries` are always distinct, so `ka` and `kb` are never equal here.
const compareKeys = ([ka]: [string, unknown], [kb]: [string, unknown]) => (ka < kb ? -1 : 1)

const deterministicReplacer = (_: any, v: any) => {
  return typeof v !== 'object' || v === null || Array.isArray(v) ? v :
    Object.fromEntries(Object.entries(v).sort(compareKeys))
}

/**
 * Derives the cache-key digest for a `getWithBody` request body. MD5 is used only for that -
 * it is not a security-sensitive value, and no secret protection or tamper-integrity
 * guarantee is being made. Never throws, even if `onSerializeError` does.
 */
export function computeBodyHash(data: any, onSerializeError?: () => void): string {
  if (ArrayBuffer.isView(data)) {
    // Cast needed: the `@types/node@12.x` pinned in this repo types `Hash.update` against a
    // narrower `BinaryLike` than the `ArrayBufferView` the `ArrayBuffer.isView` guard produces,
    // even though every ArrayBufferView (Buffer, TypedArray, DataView) is accepted at runtime.
    return createHash('md5').update(data as Buffer).digest('hex') // NOSONAR
  }

  // A raw ArrayBuffer isn't an ArrayBufferView and has no enumerable own properties, so it
  // would serialize to '{}' for any content - colliding on the same bodyHash. The toString
  // tag check (unlike `instanceof`) also matches an ArrayBuffer created in another realm.
  if (Object.prototype.toString.call(data) === '[object ArrayBuffer]') {
    return createHash('md5').update(Buffer.from(data)).digest('hex') // NOSONAR
  }

  if (data === undefined) {
    // getWithBody's `data` is optional, so an omitted body is a normal, deterministic case -
    // not a serialization failure. It must hash to a fixed value, or callers that omit the
    // body would get a different bodyHash (and cache-key) on every single request, permanently
    // defeating the cache rather than the "one-time miss" the randomBytes fallback below allows.
    return createHash('md5').update('undefined').digest('hex') // NOSONAR
  }

  // The failure is reported once, after JSON.stringify has unwound - not from inside the
  // replacer, where a stack overflow (e.g. circular reference) leaves no room to call it.
  let serializeFailed = false

  const replacer = (key: string, value: any) => {
    try {
      return deterministicReplacer(key, value)
    }
    catch {
      // I don't believe this will ever happen, but just in case
      // Also, I didn't include error as I am unsure if it would have sensitive information
      serializeFailed = true
      return value
    }
  }

  try {
    return createHash('md5').update(JSON.stringify(data, replacer)).digest('hex') // NOSONAR
  }
  catch {
    // JSON.stringify can still fail (or return undefined) even after the replacer recovers -
    // e.g. a property whose getter fails on every access (not just the one the replacer
    // already caught), a circular reference, or a top-level function/symbol that serializes
    // to `undefined`. A constant fallback (e.g. String(data)) would collapse any two
    // different bodies that hit this path into the same bodyHash - a cache-key collision,
    // not just a miss. Use random bytes instead: every call gets a unique key, so the hash
    // can only ever cause a cache miss, never serve the wrong content. Such a body is
    // invalid anyway, so the request itself still fails later when axios serializes it.
    serializeFailed = true
    return randomBytes(16).toString('hex')
  }
  finally {
    if (serializeFailed) {
      try {
        onSerializeError?.()
      }
      catch {
        // A failing callback (e.g. a logger that throws) must never turn the safe fallback
        // path back into a throw.
      }
    }
  }
}
