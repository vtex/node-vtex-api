import { WindowedCounters } from './WindowedCounters';

describe('WindowedCounters', () => {
  let counters: WindowedCounters;

  beforeEach(() => {
    // Arrange: Create a fresh instance for each test
    counters = new WindowedCounters();
  });

  describe('countHit', () => {
    it('should increment hits by 1', () => {
      // Arrange & Act
      counters.countHit();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.hits).toBe(1);
    });

    it('should increment hits multiple times', () => {
      // Arrange & Act
      counters.countHit();
      counters.countHit();
      counters.countHit();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.hits).toBe(3);
    });

    it('should not affect other counters', () => {
      // Arrange & Act
      counters.countHit();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.misses).toBe(0);
      expect(cumulative.total).toBe(0);
      expect(cumulative.disposed).toBe(0);
    });
  });

  describe('countMiss', () => {
    it('should increment misses by 1', () => {
      // Arrange & Act
      counters.countMiss();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.misses).toBe(1);
    });

    it('should increment misses multiple times', () => {
      // Arrange & Act
      counters.countMiss();
      counters.countMiss();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.misses).toBe(2);
    });

    it('should not affect other counters', () => {
      // Arrange & Act
      counters.countMiss();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.hits).toBe(0);
      expect(cumulative.total).toBe(0);
      expect(cumulative.disposed).toBe(0);
    });
  });

  describe('countRead', () => {
    it('should increment total by 1', () => {
      // Arrange & Act
      counters.countRead();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.total).toBe(1);
    });

    it('should increment total multiple times', () => {
      // Arrange & Act
      counters.countRead();
      counters.countRead();
      counters.countRead();
      counters.countRead();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.total).toBe(4);
    });

    it('should not affect other counters', () => {
      // Arrange & Act
      counters.countRead();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.hits).toBe(0);
      expect(cumulative.misses).toBe(0);
      expect(cumulative.disposed).toBe(0);
    });
  });

  describe('countDisposed', () => {
    it('should increment disposed by 1', () => {
      // Arrange & Act
      counters.countDisposed();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.disposed).toBe(1);
    });

    it('should increment disposed multiple times', () => {
      // Arrange & Act
      counters.countDisposed();
      counters.countDisposed();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.disposed).toBe(2);
    });

    it('should not affect other counters', () => {
      // Arrange & Act
      counters.countDisposed();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative.hits).toBe(0);
      expect(cumulative.misses).toBe(0);
      expect(cumulative.total).toBe(0);
    });
  });

  describe('cumulative', () => {
    it('should return all zeros initially', () => {
      // Arrange & Act
      const cumulative = counters.cumulative();

      // Assert
      expect(cumulative).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      });
    });

    it('should return cumulative counts after incrementing', () => {
      // Arrange
      counters.countHit();
      counters.countHit();
      counters.countMiss();
      counters.countRead();
      counters.countRead();
      counters.countDisposed();

      // Act
      const cumulative = counters.cumulative();

      // Assert
      expect(cumulative).toEqual({
        disposed: 1,
        hits: 2,
        misses: 1,
        total: 2,
      });
    });

    it('should return monotonically increasing values', () => {
      // Arrange & Act
      counters.countHit();
      const first = counters.cumulative();
      counters.countHit();
      const second = counters.cumulative();

      // Assert
      expect(second.hits).toBeGreaterThan(first.hits);
      expect(second.hits).toBe(first.hits + 1);
    });

    it('should not modify internal state', () => {
      // Arrange
      counters.countHit();
      counters.countMiss();

      // Act
      const first = counters.cumulative();
      const second = counters.cumulative();

      // Assert
      expect(first).toEqual(second);
    });

    it('should return a new object each time', () => {
      // Arrange & Act
      const first = counters.cumulative();
      const second = counters.cumulative();

      // Assert
      expect(first).not.toBe(second);
    });
  });

  describe('windowed', () => {
    it('should return all zeros on first call', () => {
      // Arrange & Act
      const windowed = counters.windowed();

      // Assert
      expect(windowed).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      });
    });

    it('should return delta since previous windowed call', () => {
      // Arrange
      counters.countHit();
      counters.countHit();
      counters.countMiss();

      // Act
      const first = counters.windowed();

      // Assert
      expect(first).toEqual({
        disposed: 0,
        hits: 2,
        misses: 1,
        total: 0,
      });
    });

    it('should reset window after reporting', () => {
      // Arrange
      counters.countHit();
      counters.countHit();
      counters.windowed(); // Report the first window

      // Act
      counters.countHit(); // Add more hits
      const second = counters.windowed();

      // Assert
      expect(second).toEqual({
        disposed: 0,
        hits: 1,
        misses: 0,
        total: 0,
      });
    });

    it('should track multiple windows independently', () => {
      // Arrange & Act
      counters.countHit();
      counters.countMiss();
      const first = counters.windowed();

      counters.countHit();
      counters.countHit();
      counters.countMiss();
      const second = counters.windowed();

      counters.countHit();
      const third = counters.windowed();

      // Assert
      expect(first).toEqual({ disposed: 0, hits: 1, misses: 1, total: 0 });
      expect(second).toEqual({ disposed: 0, hits: 2, misses: 1, total: 0 });
      expect(third).toEqual({ disposed: 0, hits: 1, misses: 0, total: 0 });
    });

    it('should return zero for all counters after second windowed call with no increments', () => {
      // Arrange
      counters.countHit();
      counters.windowed();

      // Act
      const second = counters.windowed();

      // Assert
      expect(second).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      });
    });

    it('should not affect cumulative counts', () => {
      // Arrange
      counters.countHit();
      counters.countHit();
      counters.countMiss();
      const before = counters.cumulative();

      // Act
      counters.windowed();
      const after = counters.cumulative();

      // Assert
      expect(before).toEqual(after);
    });

    it('should return a new object each time', () => {
      // Arrange & Act
      const first = counters.windowed();
      const second = counters.windowed();

      // Assert
      expect(first).not.toBe(second);
    });
  });

  describe('mixed operations', () => {
    it('should handle complex sequence of hits, misses, reads, and disposed', () => {
      // Arrange & Act
      counters.countHit();
      counters.countRead();
      counters.countMiss();
      counters.countHit();
      counters.countDisposed();
      counters.countRead();

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative).toEqual({
        disposed: 1,
        hits: 2,
        misses: 1,
        total: 2,
      });
    });

    it('should handle windowed reads with all counter types', () => {
      // Arrange
      counters.countHit();
      counters.countHit();
      counters.countMiss();
      counters.countRead();
      counters.countRead();
      counters.countDisposed();

      // Act
      const windowed = counters.windowed();

      // Assert
      expect(windowed).toEqual({
        disposed: 1,
        hits: 2,
        misses: 1,
        total: 2,
      });
    });

    it('should isolate windowed and cumulative readers', () => {
      // Arrange
      counters.countHit();
      counters.countHit();
      counters.countMiss();

      // Act - Read windowed first
      const windowed1 = counters.windowed();

      // Add more counts
      counters.countHit();
      counters.countMiss();
      counters.countMiss();

      // Assert - Cumulative should see all counts
      const cumulative = counters.cumulative();
      expect(cumulative).toEqual({
        disposed: 0,
        hits: 3,
        misses: 3,
        total: 0,
      });

      // Windowed should see only new counts since last windowed read
      const windowed2 = counters.windowed();
      expect(windowed2).toEqual({
        disposed: 0,
        hits: 1,
        misses: 2,
        total: 0,
      });
    });

    it('should maintain correct state across many operations', () => {
      // Arrange
      for (let i = 0; i < 10; i += 1) {
        counters.countHit();
      }
      for (let i = 0; i < 5; i += 1) {
        counters.countMiss();
      }
      for (let i = 0; i < 7; i += 1) {
        counters.countRead();
      }
      for (let i = 0; i < 3; i += 1) {
        counters.countDisposed();
      }

      // Act
      const cumulative = counters.cumulative();
      const windowed = counters.windowed();

      // Assert
      expect(cumulative).toEqual({
        disposed: 3,
        hits: 10,
        misses: 5,
        total: 7,
      });
      expect(windowed).toEqual({
        disposed: 3,
        hits: 10,
        misses: 5,
        total: 7,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle large numbers', () => {
      // Arrange
      const largeNum = 1000000;
      for (let i = 0; i < largeNum; i += 1) {
        counters.countHit();
      }

      // Act
      const cumulative = counters.cumulative();

      // Assert
      expect(cumulative.hits).toBe(largeNum);
    });

    it('should maintain precision with many increments', () => {
      // Arrange & Act
      for (let i = 0; i < 100; i += 1) {
        counters.countHit();
        counters.countMiss();
        counters.countRead();
        counters.countDisposed();
      }

      // Assert
      const cumulative = counters.cumulative();
      expect(cumulative).toEqual({
        disposed: 100,
        hits: 100,
        misses: 100,
        total: 100,
      });
    });

    it('should handle rapid windowed calls', () => {
      // Arrange
      counters.countHit();

      // Act
      const first = counters.windowed();
      const second = counters.windowed();
      const third = counters.windowed();

      // Assert
      expect(first).toEqual({ disposed: 0, hits: 1, misses: 0, total: 0 });
      expect(second).toEqual({ disposed: 0, hits: 0, misses: 0, total: 0 });
      expect(third).toEqual({ disposed: 0, hits: 0, misses: 0, total: 0 });
    });
  });
});
