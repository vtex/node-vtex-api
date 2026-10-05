import { WindowedCounters } from './WindowedCounters'

describe('WindowedCounters', () => {
  let counters: WindowedCounters

  beforeEach(() => {
    // Arrange
    counters = new WindowedCounters()
  })

  describe('countHit', () => {
    it('should increment hits by 1', () => {
      // Act
      counters.countHit()

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative.hits).toBe(1)
    })

    it('should increment hits multiple times', () => {
      // Act
      counters.countHit()
      counters.countHit()
      counters.countHit()

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative.hits).toBe(3)
    })

    it('should handle many increments', () => {
      // Act
      for (let i = 0; i < 1000; i++) {
        counters.countHit()
      }

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative.hits).toBe(1000)
    })
  })

  describe('countRead', () => {
    it('should increment total by 1', () => {
      // Act
      counters.countRead()

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative.total).toBe(1)
    })

    it('should increment total multiple times', () => {
      // Act
      counters.countRead()
      counters.countRead()
      counters.countRead()

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative.total).toBe(3)
    })

    it('should handle many increments', () => {
      // Act
      for (let i = 0; i < 500; i++) {
        counters.countRead()
      }

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative.total).toBe(500)
    })
  })

  describe('countDisposed', () => {
    it('should increment disposed by 1', () => {
      // Act
      counters.countDisposed()

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative.disposed).toBe(1)
    })

    it('should increment disposed multiple times', () => {
      // Act
      counters.countDisposed()
      counters.countDisposed()

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative.disposed).toBe(2)
    })

    it('should handle many increments', () => {
      // Act
      for (let i = 0; i < 100; i++) {
        counters.countDisposed()
      }

      // Assert
      const cumulative = counters.cumulative()
      expect(cumulative.disposed).toBe(100)
    })
  })

  describe('cumulative', () => {
    it('should return all zeros initially', () => {
      // Act
      const result = counters.cumulative()

      // Assert
      expect(result).toEqual({ disposed: 0, hits: 0, total: 0 })
    })

    it('should return cumulative counts after increments', () => {
      // Arrange
      counters.countHit()
      counters.countHit()
      counters.countRead()
      counters.countRead()
      counters.countRead()
      counters.countDisposed()

      // Act
      const result = counters.cumulative()

      // Assert
      expect(result).toEqual({ disposed: 1, hits: 2, total: 3 })
    })

    it('should not reset counts on multiple calls', () => {
      // Arrange
      counters.countHit()
      counters.countRead()

      // Act
      const first = counters.cumulative()
      const second = counters.cumulative()

      // Assert
      expect(first).toEqual(second)
      expect(first).toEqual({ disposed: 0, hits: 1, total: 1 })
    })

    it('should include all counter types', () => {
      // Arrange
      counters.countHit()
      counters.countRead()
      counters.countDisposed()

      // Act
      const result = counters.cumulative()

      // Assert
      expect(result).toHaveProperty('disposed')
      expect(result).toHaveProperty('hits')
      expect(result).toHaveProperty('total')
    })

    it('should return a new object on each call', () => {
      // Act
      const first = counters.cumulative()
      const second = counters.cumulative()

      // Assert
      expect(first).not.toBe(second)
    })
  })

  describe('windowed', () => {
    it('should return all zeros on first call', () => {
      // Act
      const result = counters.windowed()

      // Assert
      expect(result).toEqual({ disposed: 0, hits: 0, total: 0 })
    })

    it('should return delta on first call after increments', () => {
      // Arrange
      counters.countHit()
      counters.countHit()
      counters.countRead()
      counters.countDisposed()

      // Act
      const result = counters.windowed()

      // Assert
      expect(result).toEqual({ disposed: 1, hits: 2, total: 1 })
    })

    it('should return zero on second call without new increments', () => {
      // Arrange
      counters.countHit()
      counters.windowed()

      // Act
      const result = counters.windowed()

      // Assert
      expect(result).toEqual({ disposed: 0, hits: 0, total: 0 })
    })

    it('should return only the delta between calls', () => {
      // Arrange
      counters.countHit()
      counters.countHit()
      counters.countRead()
      counters.windowed()

      counters.countHit()
      counters.countRead()
      counters.countRead()
      counters.countDisposed()

      // Act
      const result = counters.windowed()

      // Assert
      expect(result).toEqual({ disposed: 1, hits: 1, total: 2 })
    })

    it('should update reported state after windowed call', () => {
      // Arrange
      counters.countHit()
      counters.countRead()

      // Act
      counters.windowed()
      const cumulative = counters.cumulative()
      const windowed = counters.windowed()

      // Assert
      expect(cumulative).toEqual({ disposed: 0, hits: 1, total: 1 })
      expect(windowed).toEqual({ disposed: 0, hits: 0, total: 0 })
    })

    it('should handle multiple increments and multiple windows', () => {
      // Arrange & Act
      counters.countHit()
      counters.countHit()
      const first = counters.windowed()

      counters.countHit()
      const second = counters.windowed()

      counters.countHit()
      counters.countHit()
      counters.countHit()
      const third = counters.windowed()

      // Assert
      expect(first).toEqual({ disposed: 0, hits: 2, total: 0 })
      expect(second).toEqual({ disposed: 0, hits: 1, total: 0 })
      expect(third).toEqual({ disposed: 0, hits: 3, total: 0 })
    })

    it('should return a new object on each call', () => {
      // Act
      const first = counters.windowed()
      const second = counters.windowed()

      // Assert
      expect(first).not.toBe(second)
    })
  })

  describe('windowed and cumulative independence', () => {
    it('should allow windowed and cumulative readers to share cache without interference', () => {
      // Arrange
      counters.countHit()
      counters.countHit()
      counters.countRead()

      // Act - first consumer uses windowed (legacy flush)
      const windowedResult = counters.windowed()
      // second consumer uses cumulative (observable reader)
      const cumulativeResult = counters.cumulative()
      // add more counts
      counters.countHit()
      // second windowed read
      const windowedResult2 = counters.windowed()

      // Assert
      expect(windowedResult).toEqual({ disposed: 0, hits: 2, total: 1 })
      expect(cumulativeResult).toEqual({ disposed: 0, hits: 2, total: 1 })
      expect(windowedResult2).toEqual({ disposed: 0, hits: 1, total: 0 })
    })
  })

  describe('mixed counter operations', () => {
    it('should track all counter types independently', () => {
      // Arrange
      counters.countHit()
      counters.countHit()
      counters.countRead()
      counters.countRead()
      counters.countRead()
      counters.countDisposed()
      counters.countDisposed()
      counters.countDisposed()
      counters.countDisposed()

      // Act
      const result = counters.cumulative()

      // Assert
      expect(result.hits).toBe(2)
      expect(result.total).toBe(3)
      expect(result.disposed).toBe(4)
    })

    it('should handle complex interleaved operations', () => {
      // Arrange & Act
      counters.countHit()
      counters.countRead()
      const window1 = counters.windowed()

      counters.countDisposed()
      counters.countHit()
      const cumul1 = counters.cumulative()

      counters.countRead()
      const window2 = counters.windowed()

      counters.countHit()
      counters.countHit()
      const cumul2 = counters.cumulative()

      // Assert
      expect(window1).toEqual({ disposed: 0, hits: 1, total: 1 })
      expect(cumul1).toEqual({ disposed: 1, hits: 2, total: 1 })
      expect(window2).toEqual({ disposed: 1, hits: 1, total: 1 })
      expect(cumul2).toEqual({ disposed: 1, hits: 4, total: 2 })
    })
  })

  describe('state isolation', () => {
    it('should maintain separate state for different instances', () => {
      // Arrange
      const counters1 = new WindowedCounters()
      const counters2 = new WindowedCounters()

      counters1.countHit()
      counters1.countHit()
      counters1.countHit()

      counters2.countHit()
      counters2.countRead()

      // Act
      const cumul1 = counters1.cumulative()
      const cumul2 = counters2.cumulative()

      // Assert
      expect(cumul1.hits).toBe(3)
      expect(cumul2.hits).toBe(1)
      expect(cumul2.total).toBe(1)
    })
  })
})
