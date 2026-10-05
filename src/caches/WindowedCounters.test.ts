import { WindowedCounters } from './WindowedCounters';

describe('WindowedCounters', () => {
  let counter: WindowedCounters;

  beforeEach(() => {
    // Arrange
    counter = new WindowedCounters();
  });

  describe('countHit', () => {
    it('should increment hits by 1', () => {
      // Act
      counter.countHit();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.hits).toBe(1);
    });

    it('should increment hits multiple times', () => {
      // Act
      counter.countHit();
      counter.countHit();
      counter.countHit();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.hits).toBe(3);
    });

    it('should not affect other counters', () => {
      // Act
      counter.countHit();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.hits).toBe(1);
      expect(cumulative.misses).toBe(0);
      expect(cumulative.total).toBe(0);
      expect(cumulative.disposed).toBe(0);
    });
  });

  describe('countMiss', () => {
    it('should increment misses by 1', () => {
      // Act
      counter.countMiss();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.misses).toBe(1);
    });

    it('should increment misses multiple times', () => {
      // Act
      counter.countMiss();
      counter.countMiss();
      counter.countMiss();
      counter.countMiss();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.misses).toBe(4);
    });

    it('should not affect other counters', () => {
      // Act
      counter.countMiss();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.misses).toBe(1);
      expect(cumulative.hits).toBe(0);
      expect(cumulative.total).toBe(0);
      expect(cumulative.disposed).toBe(0);
    });
  });

  describe('countRead', () => {
    it('should increment total by 1', () => {
      // Act
      counter.countRead();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.total).toBe(1);
    });

    it('should increment total multiple times', () => {
      // Act
      counter.countRead();
      counter.countRead();
      counter.countRead();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.total).toBe(3);
    });

    it('should not affect other counters', () => {
      // Act
      counter.countRead();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.total).toBe(1);
      expect(cumulative.hits).toBe(0);
      expect(cumulative.misses).toBe(0);
      expect(cumulative.disposed).toBe(0);
    });
  });

  describe('countDisposed', () => {
    it('should increment disposed by 1', () => {
      // Act
      counter.countDisposed();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.disposed).toBe(1);
    });

    it('should increment disposed multiple times', () => {
      // Act
      counter.countDisposed();
      counter.countDisposed();
      counter.countDisposed();
      counter.countDisposed();
      counter.countDisposed();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.disposed).toBe(5);
    });

    it('should not affect other counters', () => {
      // Act
      counter.countDisposed();

      // Assert
      const cumulative = counter.cumulative();
      expect(cumulative.disposed).toBe(1);
      expect(cumulative.hits).toBe(0);
      expect(cumulative.misses).toBe(0);
      expect(cumulative.total).toBe(0);
    });
  });

  describe('cumulative', () => {
    it('should return all counters as 0 initially', () => {
      // Act
      const result = counter.cumulative();

      // Assert
      expect(result).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      });
    });

    it('should return cumulative totals after multiple increments', () => {
      // Arrange
      counter.countHit();
      counter.countHit();
      counter.countMiss();
      counter.countRead();
      counter.countRead();
      counter.countRead();
      counter.countDisposed();

      // Act
      const result = counter.cumulative();

      // Assert
      expect(result).toEqual({
        disposed: 1,
        hits: 2,
        misses: 1,
        total: 3,
      });
    });

    it('should return cumulative counters without resetting state', () => {
      // Arrange
      counter.countHit();
      counter.countRead();

      // Act
      const result1 = counter.cumulative();
      const result2 = counter.cumulative();

      // Assert
      expect(result1).toEqual(result2);
      expect(result1).toEqual({
        disposed: 0,
        hits: 1,
        misses: 0,
        total: 1,
      });
    });

    it('should return independent object instances', () => {
      // Arrange
      counter.countHit();

      // Act
      const result1 = counter.cumulative();
      const result2 = counter.cumulative();

      // Assert
      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe('windowed', () => {
    it('should return all deltas as 0 on first call', () => {
      // Act
      const result = counter.windowed();

      // Assert
      expect(result).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      });
    });

    it('should return delta since last report', () => {
      // Arrange
      counter.countHit();
      counter.countHit();
      counter.countMiss();
      counter.countRead();
      counter.countRead();
      counter.countDisposed();

      // Act
      const result = counter.windowed();

      // Assert
      expect(result).toEqual({
        disposed: 1,
        hits: 2,
        misses: 1,
        total: 2,
      });
    });

    it('should reset windowed deltas after reporting', () => {
      // Arrange
      counter.countHit();
      counter.countRead();

      // Act
      counter.windowed();
      const secondWindow = counter.windowed();

      // Assert
      expect(secondWindow).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      });
    });

    it('should track multiple windows correctly', () => {
      // Arrange & Act & Assert - First window
      counter.countHit();
      counter.countHit();
      counter.countRead();
      const window1 = counter.windowed();
      expect(window1).toEqual({
        disposed: 0,
        hits: 2,
        misses: 0,
        total: 1,
      });

      // Add more and check second window
      counter.countHit();
      counter.countMiss();
      counter.countMiss();
      counter.countRead();
      const window2 = counter.windowed();
      expect(window2).toEqual({
        disposed: 0,
        hits: 1,
        misses: 2,
        total: 1,
      });
    });

    it('should return independent object instances', () => {
      // Arrange
      counter.countHit();

      // Act
      const result1 = counter.windowed();
      const result2 = counter.windowed();

      // Assert
      expect(result1).not.toBe(result2);
    });
  });

  describe('integration: windowed and cumulative', () => {
    it('should allow windowed and cumulative readers to share cache without consuming each other', () => {
      // Arrange & Act
      counter.countHit();
      counter.countMiss();
      counter.countRead();
      counter.countRead();

      const windowed1 = counter.windowed();
      const cumulative1 = counter.cumulative();

      counter.countHit();
      counter.countRead();

      const cumulative2 = counter.cumulative();
      const windowed2 = counter.windowed();

      // Assert
      expect(windowed1).toEqual({
        disposed: 0,
        hits: 1,
        misses: 1,
        total: 2,
      });
      expect(cumulative1).toEqual({
        disposed: 0,
        hits: 1,
        misses: 1,
        total: 2,
      });
      expect(cumulative2).toEqual({
        disposed: 0,
        hits: 2,
        misses: 1,
        total: 3,
      });
      expect(windowed2).toEqual({
        disposed: 0,
        hits: 1,
        misses: 0,
        total: 1,
      });
    });

    it('cumulative should always reflect total process lifetime', () => {
      // Arrange & Act
      counter.countHit();
      counter.countMiss();
      counter.countDisposed();

      const cumulative1 = counter.cumulative();
      counter.windowed();
      const cumulative2 = counter.cumulative();

      // Assert - windowed does not affect cumulative
      expect(cumulative1).toEqual(cumulative2);
      expect(cumulative2).toEqual({
        disposed: 1,
        hits: 1,
        misses: 1,
        total: 0,
      });
    });
  });

  describe('edge cases and boundary values', () => {
    it('should handle large numbers of increments', () => {
      // Arrange
      const largeNumber = 1000000;

      // Act
      for (let i = 0; i < largeNumber; i++) {
        counter.countHit();
      }
      const result = counter.cumulative();

      // Assert
      expect(result.hits).toBe(largeNumber);
    });

    it('should handle mixed operations with large numbers', () => {
      // Arrange
      for (let i = 0; i < 500; i++) {
        counter.countHit();
        counter.countMiss();
        counter.countRead();
        counter.countDisposed();
      }

      // Act
      const windowed = counter.windowed();
      const cumulative = counter.cumulative();

      // Assert
      expect(windowed).toEqual({
        disposed: 500,
        hits: 500,
        misses: 500,
        total: 500,
      });
      expect(cumulative).toEqual({
        disposed: 500,
        hits: 500,
        misses: 500,
        total: 500,
      });
    });

    it('should handle repeated windowed calls', () => {
      // Arrange
      counter.countHit();
      const results: Array<{ disposed: number; hits: number; misses: number; total: number }> = [];

      // Act
      for (let i = 0; i < 5; i++) {
        results.push(counter.windowed());
      }

      // Assert - first window captures the hit, others are empty
      expect(results[0]).toEqual({
        disposed: 0,
        hits: 1,
        misses: 0,
        total: 0,
      });
      for (let i = 1; i < 5; i++) {
        expect(results[i]).toEqual({
          disposed: 0,
          hits: 0,
          misses: 0,
          total: 0,
        });
      }
    });

    it('should initialize with zeros', () => {
      // Act
      const windowed = counter.windowed();
      const cumulative = counter.cumulative();

      // Assert
      expect(windowed).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      });
      expect(cumulative).toEqual({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      });
    });
  });

  describe('state management', () => {
    it('should maintain independent instances', () => {
      // Arrange
      const counter1 = new WindowedCounters();
      const counter2 = new WindowedCounters();

      // Act
      counter1.countHit();
      counter1.countHit();
      counter2.countHit();

      // Assert
      expect(counter1.cumulative().hits).toBe(2);
      expect(counter2.cumulative().hits).toBe(1);
    });

    it('should not leak state between windowed calls', () => {
      // Arrange
      const counter1 = new WindowedCounters();
      const counter2 = new WindowedCounters();

      counter1.countHit();
      counter2.countMiss();

      // Act
      const window1 = counter1.windowed();
      const window2 = counter2.windowed();

      // Assert
      expect(window1).toEqual({
        disposed: 0,
        hits: 1,
        misses: 0,
        total: 0,
      });
      expect(window2).toEqual({
        disposed: 0,
        hits: 0,
        misses: 1,
        total: 0,
      });
    });
  });
});
