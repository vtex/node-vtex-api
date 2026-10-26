import {
  deriveCallsiteName,
  outranks,
  resetCacheNamingForTests,
  resolveCacheTracking,
} from './cacheNaming'

describe('cacheNaming', () => {
  beforeEach(() => {
    resetCacheNamingForTests()
  })

  describe('resolveCacheTracking', () => {
    it('treats a string as an explicit name', () => {
      expect(resolveCacheTracking('pages')).toEqual({ name: 'pages', source: 'explicit' })
    })

    it('treats false as an opt-out', () => {
      expect(resolveCacheTracking(false)).toBeUndefined()
    })

    it('derives a callsite name when the option is absent', () => {
      const decision = resolveCacheTracking(undefined)

      expect(decision).toEqual({
        name: 'src/caches/cacheNaming.test.ts',
        source: 'callsite',
      })
    })

    it('derives a callsite name for an empty string rather than taking it', () => {
      const decision = resolveCacheTracking('')

      expect(decision).toEqual({
        name: 'src/caches/cacheNaming.test.ts',
        source: 'callsite',
      })
    })
  })

  describe('deriveCallsiteName', () => {
    it('names the first cache after the file that constructs it, relative to the app root', () => {
      expect(deriveCallsiteName()).toBe('src/caches/cacheNaming.test.ts')
    })

    it('suffixes later caches from the same file with an ordinal', () => {
      expect(deriveCallsiteName()).toBe('src/caches/cacheNaming.test.ts')
      expect(deriveCallsiteName()).toBe('src/caches/cacheNaming.test.ts#2')
      expect(deriveCallsiteName()).toBe('src/caches/cacheNaming.test.ts#3')
    })

    it('restarts the ordinals after a test reset', () => {
      deriveCallsiteName()
      resetCacheNamingForTests()

      expect(deriveCallsiteName()).toBe('src/caches/cacheNaming.test.ts')
    })
  })

  describe('outranks', () => {
    it('orders callsite below client below explicit', () => {
      expect(outranks('client', 'callsite')).toBe(true)
      expect(outranks('explicit', 'callsite')).toBe(true)
      expect(outranks('explicit', 'client')).toBe(true)

      expect(outranks('callsite', 'client')).toBe(false)
      expect(outranks('client', 'explicit')).toBe(false)
      expect(outranks('callsite', 'explicit')).toBe(false)

      expect(outranks('explicit', 'explicit')).toBe(false)
    })
  })
})
