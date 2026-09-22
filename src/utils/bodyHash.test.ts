import { createHash } from 'crypto'
import { gzipSync } from 'zlib'
import { computeBodyHash } from './bodyHash'

const deterministicReplacer = (_: any, v: any) => {
  try {
    return typeof v !== 'object' || v === null || Array.isArray(v) ? v :
      Object.fromEntries(Object.entries(v).sort(([ka], [kb]) =>
        ka < kb ? -1 : ka > kb ? 1 : 0))
  }
  catch (error) {
    return v
  }
}

describe('computeBodyHash', () => {
  describe('non-Buffer data', () => {
    it('produces the same hash as JSON.stringify with the deterministic replacer', () => {
      const data = { b: 2, a: 1 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('produces the same hash regardless of key order (deterministic replacer)', () => {
      expect(computeBodyHash({ a: 1, b: 2 })).toBe(computeBodyHash({ b: 2, a: 1 }))
    })

    it('recovers via onSerializeError instead of throwing when reading a property fails', () => {
      // Simulates a property access that fails once (e.g. a lazily-computed value
      // backed by an external resource) - not a plain data-shape issue, exactly
      // the kind of unexpected failure the try/catch around the replacer guards against.
      const onSerializeError = jest.fn()
      let getterCalls = 0
      const flaky: Record<string, any> = {}
      Object.defineProperty(flaky, 'x', {
        enumerable: true,
        get() {
          getterCalls += 1
          if (getterCalls === 1) {
            throw new Error('boom')
          }
          return 42
        },
      })

      expect(() => computeBodyHash(flaky, onSerializeError)).not.toThrow()
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('recovers without throwing when no onSerializeError callback is provided', () => {
      let getterCalls = 0
      const flaky: Record<string, any> = {}
      Object.defineProperty(flaky, 'x', {
        enumerable: true,
        get() {
          getterCalls += 1
          if (getterCalls === 1) {
            throw new Error('boom')
          }
          return 42
        },
      })

      expect(() => computeBodyHash(flaky)).not.toThrow()
    })

    it('does not throw when a property getter fails on every access, not just the first', () => {
      // JSON.stringify's own traversal re-reads a nested value's own properties to
      // serialize it, *after* the replacer already recovered from the first failure -
      // that second read happens outside the replacer's own try/catch, so it must be
      // guarded independently.
      const onSerializeError = jest.fn()
      const alwaysFlaky: Record<string, any> = {}
      Object.defineProperty(alwaysFlaky, 'x', {
        enumerable: true,
        get() {
          throw new Error('always boom')
        },
      })

      expect(() => computeBodyHash({ nested: alwaysFlaky }, onSerializeError)).not.toThrow()
      // Even though both the replacer's catch and the outer JSON.stringify catch observe
      // this failure, onSerializeError should only be reported once per call.
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when data is undefined', () => {
      const onSerializeError = jest.fn()

      expect(() => computeBodyHash(undefined, onSerializeError)).not.toThrow()
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when data is undefined and no callback is provided', () => {
      expect(() => computeBodyHash(undefined)).not.toThrow()
    })

    it('does not collide for structurally different data that both fail to serialize (e.g. circular references)', () => {
      // A fallback like String(data) collapses any plain object to a constant
      // "[object Object]", so two unrelated bodies that both hit the fallback path
      // would otherwise get the same bodyHash - a cache-key collision, not just a miss.
      const circularA: Record<string, any> = { name: 'bodyA' }
      circularA.self = circularA

      const circularB: Record<string, any> = { name: 'bodyB', other: 'completely different content' }
      circularB.self = circularB

      expect(() => computeBodyHash(circularA)).not.toThrow()
      expect(() => computeBodyHash(circularB)).not.toThrow()
      expect(computeBodyHash(circularA)).not.toBe(computeBodyHash(circularB))
    })
  })

  describe('Buffer data', () => {
    it('produces the same hash for two buffers with identical bytes', () => {
      const bufferA = Buffer.from([1, 2, 3, 4, 5])
      const bufferB = Buffer.from([1, 2, 3, 4, 5])

      expect(computeBodyHash(bufferA)).toBe(computeBodyHash(bufferB))
    })

    it('produces different hashes for buffers with different bytes', () => {
      const bufferA = Buffer.from([1, 2, 3, 4, 5])
      const bufferB = Buffer.from([1, 2, 3, 4, 6])

      expect(computeBodyHash(bufferA)).not.toBe(computeBodyHash(bufferB))
    })

    it('hashes the raw buffer bytes directly, not the JSON.stringify representation', () => {
      const buffer = Buffer.from([1, 2, 3, 4, 5])
      const legacyHash = createHash('md5').update(JSON.stringify(buffer, deterministicReplacer)).digest('hex')
      const directHash = createHash('md5').update(buffer).digest('hex')

      expect(computeBodyHash(buffer)).not.toBe(legacyHash)
      expect(computeBodyHash(buffer)).toBe(directHash)
    })
  })

  describe('other ArrayBuffer views (e.g. Uint8Array)', () => {
    it('hashes a Uint8Array the same way as the equivalent Buffer', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5])

      expect(computeBodyHash(bytes)).toBe(computeBodyHash(Buffer.from(bytes)))
    })

    it('produces different hashes for Uint8Arrays with different bytes', () => {
      const bytesA = new Uint8Array([1, 2, 3, 4, 5])
      const bytesB = new Uint8Array([1, 2, 3, 4, 6])

      expect(computeBodyHash(bytesA)).not.toBe(computeBodyHash(bytesB))
    })
  })

  describe('gzip-compressed body across separate requests (render-ssr scenario)', () => {
    it('produces the same hash when the same JSON payload is gzip-compressed independently twice', () => {
      const payload = JSON.stringify({ page: 'home', props: { locale: 'en-US', items: [1, 2, 3] } })

      // Two independent compressions of the same content, as if produced by two
      // separate requests, rather than reusing the same Buffer instance.
      const bufferFromRequestA = gzipSync(Buffer.from(payload))
      const bufferFromRequestB = gzipSync(Buffer.from(payload))

      expect(bufferFromRequestA.equals(bufferFromRequestB)).toBe(true)
      expect(computeBodyHash(bufferFromRequestA)).toBe(computeBodyHash(bufferFromRequestB))
    })

    it('produces a different hash when the underlying JSON payload differs', () => {
      const bufferA = gzipSync(Buffer.from(JSON.stringify({ page: 'home' })))
      const bufferB = gzipSync(Buffer.from(JSON.stringify({ page: 'checkout' })))

      expect(computeBodyHash(bufferA)).not.toBe(computeBodyHash(bufferB))
    })
  })
})
