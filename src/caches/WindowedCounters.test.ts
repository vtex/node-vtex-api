import { WindowedCounters } from './WindowedCounters'

describe('WindowedCounters', () => {
  describe('countHit', () => {
    it('should increment hits by 1', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countHit()
      const result = counters.cumulative()

      // Assert
      expect(result.hits).toBe(1)
    })

    it('should increment hits multiple times', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countHit()
      counters.countHit()
      counters.countHit()
      const result = counters.cumulative()

      // Assert
      expect(result.hits).toBe(3)
    })

    it('should not affect other counters', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countHit()
      const result = counters.cumulative()

      // Assert
      expect(result.hits).toBe(1)
      expect(result.misses).toBe(0)
      expect(result.total).toBe(0)
      expect(result.disposed).toBe(0)
    })
  })

  describe('countMiss', () => {
    it('should increment misses by 1', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countMiss()
      const result = counters.cumulative()

      // Assert
      expect(result.misses).toBe(1)
    })

    it('should increment misses multiple times', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countMiss()
      counters.countMiss()
      const result = counters.cumulative()

      // Assert
      expect(result.misses).toBe(2)
    })

    it('should not affect other counters', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countMiss()
      const result = counters.cumulative()

      // Assert
      expect(result.hits).toBe(0)
      expect(result.misses).toBe(1)
      expect(result.total).toBe(0)
      expect(result.disposed).toBe(0)
    })
  })

  describe('countRead', () => {
    it('should increment total by 1', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countRead()
      const result = counters.cumulative()

      // Assert
      expect(result.total).toBe(1)
    })

    it('should increment total multiple times', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countRead()
      counters.countRead()
      counters.countRead()
      counters.countRead()
      const result = counters.cumulative()

      // Assert
      expect(result.total).toBe(4)
    })

    it('should not affect other counters', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countRead()
      const result = counters.cumulative()

      // Assert
      expect(result.hits).toBe(0)
      expect(result.misses).toBe(0)
      expect(result.total).toBe(1)
      expect(result.disposed).toBe(0)
    })
  })

  describe('countDisposed', () => {
    it('should increment disposed by 1', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countDisposed()
      const result = counters.cumulative()

      // Assert
      expect(result.disposed).toBe(1)
    })

    it('should increment disposed multiple times', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countDisposed()
      counters.countDisposed()
      const result = counters.cumulative()

      // Assert
      expect(result.disposed).toBe(2)
    })

    it('should not affect other counters', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countDisposed()
      const result = counters.cumulative()

      // Assert
      expect(result.hits).toBe(0)
      expect(result.misses).toBe(0)
      expect(result.total).toBe(0)
      expect(result.disposed).toBe(1)
    })
  })

  describe('cumulative', () => {
    it('should return all counters at zero initially', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      const result = counters.cumulative()

      // Assert
      expect(result).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })
    })

    it('should return cumulative sum of all increments', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countHit()
      counters.countHit()
      counters.countMiss()
      counters.countRead()
      counters.countRead()
      counters.countRead()
      counters.countDisposed()
      const result = counters.cumulative()

      // Assert
      expect(result).toEqual({
        disposed: 1,
        hits: 2,
        misses: 1,
        total: 3,
      })
    })

    it('should return same values on repeated calls without new increments', () => {
      // Arrange
      const counters = new WindowedCounters()
      counters.countHit()
      counters.countHit()

      // Act
      const result1 = counters.cumulative()
      const result2 = counters.cumulative()

      // Assert
      expect(result1).toEqual(result2)
      expect(result1).toEqual({
        disposed: 0,
        hits: 2,
        misses: 0,
        total: 0,
      })
    })

    it('should not reset reported values', () => {
      // Arrange
      const counters = new WindowedCounters()
      counters.countHit()
      counters.windowed() // Report first window
      counters.countHit()

      // Act
      const result = counters.cumulative()

      // Assert
      expect(result.hits).toBe(2) // Cumulative is lifetime total
    })
  })

  describe('windowed', () => {
    it('should return deltas since last windowed call', () => {
      // Arrange
      const counters = new WindowedCounters()
      counters.countHit()
      counters.countHit()
      counters.countMiss()
      counters.countRead()

      // Act
      const window = counters.windowed()

      // Assert
      expect(window).toEqual({
        disposed: 0,
        hits: 2,
        misses: 1,
        total: 1,
      })
    })

    it('should return zeros on first call from initial state', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      const window = counters.windowed()

      // Assert
      expect(window).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })
    })

    it('should reset the window after reporting', () => {
      // Arrange
      const counters = new WindowedCounters()
      counters.countHit()
      counters.countHit()
      counters.windowed() // Report first window

      // Act
      const window = counters.windowed() // Second window without new increments

      // Assert
      expect(window).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })
    })

    it('should report only delta between windows', () => {
      // Arrange
      const counters = new WindowedCounters()
      counters.countHit()
      counters.countMiss()
      counters.windowed() // Window 1
      counters.countHit()
      counters.countHit()
      counters.countRead()

      // Act
      const window = counters.windowed() // Window 2

      // Assert
      expect(window).toEqual({
        disposed: 0,
        hits: 2,
        misses: 0,
        total: 1,
      })
    })

    it('should not affect cumulative values', () => {
      // Arrange
      const counters = new WindowedCounters()
      counters.countHit()
      counters.countHit()
      counters.countMiss()

      // Act
      counters.windowed()
      const cumulative = counters.cumulative()

      // Assert
      expect(cumulative).toEqual({
        disposed: 0,
        hits: 2,
        misses: 1,
        total: 0,
      })
    })

    it('should allow windowed and cumulative to be called interchangeably', () => {
      // Arrange
      const counters = new WindowedCounters()
      counters.countHit()
      counters.countHit()
      counters.countMiss()

      // Act
      const cumulative1 = counters.cumulative()
      const window1 = counters.windowed()
      const cumulative2 = counters.cumulative()
      counters.countHit()
      const window2 = counters.windowed()
      const cumulative3 = counters.cumulative()

      // Assert
      expect(cumulative1).toEqual({
        disposed: 0,
        hits: 2,
        misses: 1,
        total: 0,
      })
      expect(window1).toEqual({
        disposed: 0,
        hits: 2,
        misses: 1,
        total: 0,
      })
      expect(cumulative2).toEqual({
        disposed: 0,
        hits: 2,
        misses: 1,
        total: 0,
      })
      expect(window2).toEqual({
        disposed: 0,
        hits: 1,
        misses: 0,
        total: 0,
      })
      expect(cumulative3).toEqual({
        disposed: 0,
        hits: 3,
        misses: 1,
        total: 0,
      })
    })
  })

  describe('edge cases and combinations', () => {
    it('should handle large increments', () => {
      // Arrange
      const counters = new WindowedCounters()
      const largeNumber = 1000000

      // Act
      for (let i = 0; i < largeNumber; i++) {
        counters.countHit()
      }
      const result = counters.cumulative()

      // Assert
      expect(result.hits).toBe(largeNumber)
    })

    it('should handle mixed operations correctly', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      for (let i = 0; i < 5; i++) {
        counters.countHit()
      }
      for (let i = 0; i < 3; i++) {
        counters.countMiss()
      }
      for (let i = 0; i < 10; i++) {
        counters.countRead()
      }
      for (let i = 0; i < 2; i++) {
        counters.countDisposed()
      }

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative).toEqual({
        disposed: 2,
        hits: 5,
        misses: 3,
        total: 10,
      })
    })

    it('should properly track disposed counter independently', () => {
      // Arrange
      const counters = new WindowedCounters()

      // Act
      counters.countDisposed()
      counters.countDisposed()
      counters.countHit()
      const window1 = counters.windowed()

      counters.countDisposed()
      counters.countHit()
      const window2 = counters.windowed()

      // Assert
      expect(window1).toEqual({
        disposed: 2,
        hits: 1,
        misses: 0,
        total: 0,
      })
      expect(window2).toEqual({
        disposed: 1,
        hits: 1,
        misses: 0,
        total: 0,
      })
    })

    it('should return new object on each windowed call', () => {
      // Arrange
      const counters = new WindowedCounters()
      counters.countHit()

      // Act
      const window1 = counters.windowed()
      const window2 = counters.windowed()

      // Assert
      expect(window1).not.toBe(window2) // Different object references
      expect(window1).toEqual(window2) // But same values
    })

    it('should return new object on each cumulative call', () => {
      // Arrange
      const counters = new WindowedCounters()
      counters.countHit()

      // Act
      const cumulative1 = counters.cumulative()
      const cumulative2 = counters.cumulative()

      // Assert
      expect(cumulative1).not.toBe(cumulative2) // Different object references
      expect(cumulative1).toEqual(cumulative2) // But same values
    })
  })
})
