import { WindowedCounters } from './WindowedCounters'

describe('WindowedCounters', () => {
  describe('constructor', () => {
    it('should initialize with zero counters', () => {
      // Arrange & Act
      const counter = new WindowedCounters()

      // Assert
      expect(counter.cumulative()).toEqual({
        disposed: 0,
        hits: 0,
        total: 0,
      })
    })

    it('should initialize with empty windowed counters', () => {
      // Arrange & Act
      const counter = new WindowedCounters()

      // Assert
      expect(counter.windowed()).toEqual({
        disposed: 0,
        hits: 0,
        total: 0,
      })
    })
  })

  describe('countHit', () => {
    it('should increment hits by 1', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      counter.countHit()

      // Assert
      expect(counter.cumulative().hits).toBe(1)
    })

    it('should increment hits multiple times', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      counter.countHit()
      counter.countHit()
      counter.countHit()

      // Assert
      expect(counter.cumulative().hits).toBe(3)
    })

    it('should handle large number of hits', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      for (let i = 0; i < 10000; i++) {
        counter.countHit()
      }

      // Assert
      expect(counter.cumulative().hits).toBe(10000)
    })
  })

  describe('countRead', () => {
    it('should increment total by 1', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      counter.countRead()

      // Assert
      expect(counter.cumulative().total).toBe(1)
    })

    it('should increment total multiple times', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      counter.countRead()
      counter.countRead()
      counter.countRead()
      counter.countRead()

      // Assert
      expect(counter.cumulative().total).toBe(4)
    })

    it('should handle large number of reads', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      for (let i = 0; i < 50000; i++) {
        counter.countRead()
      }

      // Assert
      expect(counter.cumulative().total).toBe(50000)
    })
  })

  describe('countDisposed', () => {
    it('should increment disposed by 1', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      counter.countDisposed()

      // Assert
      expect(counter.cumulative().disposed).toBe(1)
    })

    it('should increment disposed multiple times', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      counter.countDisposed()
      counter.countDisposed()

      // Assert
      expect(counter.cumulative().disposed).toBe(2)
    })

    it('should handle large number of disposals', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      for (let i = 0; i < 1000; i++) {
        counter.countDisposed()
      }

      // Assert
      expect(counter.cumulative().disposed).toBe(1000)
    })
  })

  describe('cumulative', () => {
    it('should return all cumulative values without resetting', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()
      counter.countRead()
      counter.countRead()
      counter.countDisposed()

      // Act
      const result = counter.cumulative()

      // Assert
      expect(result).toEqual({
        hits: 1,
        total: 2,
        disposed: 1,
      })
    })

    it('should return cumulative values on multiple calls', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()
      counter.countRead()
      counter.countDisposed()

      // Act
      const result1 = counter.cumulative()
      const result2 = counter.cumulative()

      // Assert
      expect(result1).toEqual(result2)
      expect(result1).toEqual({
        hits: 1,
        total: 1,
        disposed: 1,
      })
    })

    it('should reflect increments after previous cumulative call', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()

      // Act
      const result1 = counter.cumulative()
      counter.countHit()
      const result2 = counter.cumulative()

      // Assert
      expect(result1.hits).toBe(1)
      expect(result2.hits).toBe(2)
    })

    it('should return fresh object each call', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()

      // Act
      const result1 = counter.cumulative()
      const result2 = counter.cumulative()

      // Assert
      expect(result1).not.toBe(result2)
      expect(result1).toEqual(result2)
    })
  })

  describe('windowed', () => {
    it('should return delta since previous windowed read', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()
      counter.countHit()
      counter.countRead()
      counter.countDisposed()

      // Act
      const window = counter.windowed()

      // Assert
      expect(window).toEqual({
        hits: 2,
        total: 1,
        disposed: 1,
      })
    })

    it('should reset window counters after read', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()
      counter.countRead()

      // Act
      const window1 = counter.windowed()
      const window2 = counter.windowed()

      // Assert
      expect(window1).toEqual({
        hits: 1,
        total: 1,
        disposed: 0,
      })
      expect(window2).toEqual({
        hits: 0,
        total: 0,
        disposed: 0,
      })
    })

    it('should track new increments after window reset', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()
      counter.countHit()
      counter.countRead()
      counter.windowed() // reset window

      // Act
      counter.countHit()
      counter.countRead()
      counter.countDisposed()
      const window = counter.windowed()

      // Assert
      expect(window).toEqual({
        hits: 1,
        total: 1,
        disposed: 1,
      })
    })

    it('should return zero delta when no events since last window', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()
      counter.windowed()

      // Act
      const window = counter.windowed()

      // Assert
      expect(window).toEqual({
        hits: 0,
        total: 0,
        disposed: 0,
      })
    })

    it('should return fresh object each call', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      const result1 = counter.windowed()
      const result2 = counter.windowed()

      // Assert
      expect(result1).not.toBe(result2)
      expect(result1).toEqual(result2)
    })
  })

  describe('windowed vs cumulative interaction', () => {
    it('should allow shared cache with independent windowed and cumulative readers', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()
      counter.countHit()
      counter.countRead()
      counter.countDisposed()

      // Act
      const windowed = counter.windowed()
      const cumulative = counter.cumulative()

      // Assert - windowed reports delta, cumulative reports total
      expect(windowed).toEqual({
        hits: 2,
        total: 1,
        disposed: 1,
      })
      expect(cumulative).toEqual({
        hits: 2,
        total: 1,
        disposed: 1,
      })
    })

    it('should not affect cumulative when windowing', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()
      counter.countHit()
      counter.countRead()

      // Act
      const cumBefore = counter.cumulative()
      counter.windowed()
      const cumAfter = counter.cumulative()

      // Assert
      expect(cumBefore).toEqual(cumAfter)
      expect(cumAfter).toEqual({
        hits: 2,
        total: 1,
        disposed: 0,
      })
    })

    it('should support alternating reads from windowed and cumulative', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act & Assert - First cycle
      counter.countHit()
      counter.countRead()
      expect(counter.windowed()).toEqual({
        hits: 1,
        total: 1,
        disposed: 0,
      })
      expect(counter.cumulative()).toEqual({
        hits: 1,
        total: 1,
        disposed: 0,
      })

      // Second cycle - windowed should reset, cumulative continues
      counter.countHit()
      counter.countDisposed()
      expect(counter.windowed()).toEqual({
        hits: 1,
        total: 0,
        disposed: 1,
      })
      expect(counter.cumulative()).toEqual({
        hits: 2,
        total: 1,
        disposed: 1,
      })
    })
  })

  describe('edge cases and state consistency', () => {
    it('should maintain independent state for multiple instances', () => {
      // Arrange
      const counter1 = new WindowedCounters()
      const counter2 = new WindowedCounters()
      counter1.countHit()
      counter1.countHit()
      counter2.countHit()

      // Act
      const cum1 = counter1.cumulative()
      const cum2 = counter2.cumulative()

      // Assert
      expect(cum1.hits).toBe(2)
      expect(cum2.hits).toBe(1)
    })

    it('should correctly handle all counters incremented simultaneously', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act
      counter.countHit()
      counter.countRead()
      counter.countDisposed()
      counter.countHit()
      counter.countRead()
      counter.countDisposed()

      // Assert
      const result = counter.cumulative()
      expect(result).toEqual({
        hits: 2,
        total: 2,
        disposed: 2,
      })
    })

    it('should correctly track rapid successive windowed calls', () => {
      // Arrange
      const counter = new WindowedCounters()
      counter.countHit()
      counter.countRead()
      counter.countDisposed()

      // Act
      const window1 = counter.windowed()
      const window2 = counter.windowed()
      const window3 = counter.windowed()

      // Assert
      expect(window1).toEqual({
        hits: 1,
        total: 1,
        disposed: 1,
      })
      expect(window2).toEqual({
        hits: 0,
        total: 0,
        disposed: 0,
      })
      expect(window3).toEqual({
        hits: 0,
        total: 0,
        disposed: 0,
      })
    })

    it('should correctly handle complex sequence of operations', () => {
      // Arrange
      const counter = new WindowedCounters()

      // Act - Phase 1
      counter.countHit()
      counter.countHit()
      counter.countRead()
      const window1 = counter.windowed()
      const cum1 = counter.cumulative()

      // Phase 2
      counter.countDisposed()
      counter.countHit()
      const window2 = counter.windowed()
      const cum2 = counter.cumulative()

      // Assert
      expect(window1).toEqual({
        hits: 2,
        total: 1,
        disposed: 0,
      })
      expect(cum1).toEqual({
        hits: 2,
        total: 1,
        disposed: 0,
      })
      expect(window2).toEqual({
        hits: 1,
        total: 0,
        disposed: 1,
      })
      expect(cum2).toEqual({
        hits: 3,
        total: 1,
        disposed: 1,
      })
    })
  })
})
