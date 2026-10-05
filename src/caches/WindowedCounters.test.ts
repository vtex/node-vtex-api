import { WindowedCounters } from './WindowedCounters';

describe('WindowedCounters', () => {
  let counter: WindowedCounters;

  beforeEach(() => {
    // Arrange
    counter = new WindowedCounters();
  });

  describe('constructor', () => {
    it('should initialize with zero counters', () => {
      // Act
      const windowed = counter.windowed();
      const cumulative = counter.cumulative();

      // Assert
      expect(windowed).toEqual({ disposed: 0, hits: 0, total: 0 });
      expect(cumulative).toEqual({ disposed: 0, hits: 0, total: 0 });
    });
  });

  describe('countHit', () => {
    it('should increment hits counter by 1', () => {
      // Act
      counter.countHit();
      const result = counter.cumulative();

      // Assert
      expect(result.hits).toBe(1);
    });

    it('should increment hits multiple times', () => {
      // Act
      counter.countHit();
      counter.countHit();
      counter.countHit();
      const result = counter.cumulative();

      // Assert
      expect(result.hits).toBe(3);
    });

    it('should increment hits independent of other counters', () => {
      // Act
      counter.countHit();
      counter.countRead();
      counter.countDisposed();
      const result = counter.cumulative();

      // Assert
      expect(result.hits).toBe(1);
      expect(result.total).toBe(1);
      expect(result.disposed).toBe(1);
    });
  });

  describe('countRead', () => {
    it('should increment total counter by 1', () => {
      // Act
      counter.countRead();
      const result = counter.cumulative();

      // Assert
      expect(result.total).toBe(1);
    });

    it('should increment total multiple times', () => {
      // Act
      counter.countRead();
      counter.countRead();
      counter.countRead();
      counter.countRead();
      const result = counter.cumulative();

      // Assert
      expect(result.total).toBe(4);
    });

    it('should increment total independent of other counters', () => {
      // Act
      counter.countRead();
      counter.countHit();
      counter.countDisposed();
      const result = counter.cumulative();

      // Assert
      expect(result.total).toBe(1);
      expect(result.hits).toBe(1);
      expect(result.disposed).toBe(1);
    });
  });

  describe('countDisposed', () => {
    it('should increment disposed counter by 1', () => {
      // Act
      counter.countDisposed();
      const result = counter.cumulative();

      // Assert
      expect(result.disposed).toBe(1);
    });

    it('should increment disposed multiple times', () => {
      // Act
      counter.countDisposed();
      counter.countDisposed();
      const result = counter.cumulative();

      // Assert
      expect(result.disposed).toBe(2);
    });

    it('should increment disposed independent of other counters', () => {
      // Act
      counter.countDisposed();
      counter.countHit();
      counter.countRead();
      const result = counter.cumulative();

      // Assert
      expect(result.disposed).toBe(1);
      expect(result.hits).toBe(1);
      expect(result.total).toBe(1);
    });
  });

  describe('cumulative', () => {
    it('should return cumulative counts after single increment', () => {
      // Act
      counter.countHit();
      counter.countRead();
      counter.countDisposed();
      const result = counter.cumulative();

      // Assert
      expect(result).toEqual({ disposed: 1, hits: 1, total: 1 });
    });

    it('should return cumulative counts after multiple increments', () => {
      // Act
      counter.countHit();
      counter.countHit();
      counter.countRead();
      counter.countRead();
      counter.countRead();
      counter.countDisposed();
      const result = counter.cumulative();

      // Assert
      expect(result).toEqual({ disposed: 1, hits: 2, total: 3 });
    });

    it('should return zero values on first call without any increments', () => {
      // Act
      const result = counter.cumulative();

      // Assert
      expect(result).toEqual({ disposed: 0, hits: 0, total: 0 });
    });

    it('should not reset counters on cumulative calls', () => {
      // Act
      counter.countHit();
      counter.countRead();
      counter.countDisposed();
      const result1 = counter.cumulative();
      const result2 = counter.cumulative();

      // Assert
      expect(result1).toEqual(result2);
      expect(result2).toEqual({ disposed: 1, hits: 1, total: 1 });
    });

    it('should return independent object instances', () => {
      // Act
      const result1 = counter.cumulative();
      const result2 = counter.cumulative();

      // Assert
      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe('windowed', () => {
    it('should return zero deltas on first call without any increments', () => {
      // Act
      const result = counter.windowed();

      // Assert
      expect(result).toEqual({ disposed: 0, hits: 0, total: 0 });
    });

    it('should return delta since previous read on first call after increments', () => {
      // Act
      counter.countHit();
      counter.countRead();
      counter.countDisposed();
      const result = counter.windowed();

      // Assert
      expect(result).toEqual({ disposed: 1, hits: 1, total: 1 });
    });

    it('should reset deltas after each windowed read', () => {
      // Act
      counter.countHit();
      counter.countRead();
      counter.countDisposed();
      const window1 = counter.windowed();
      const window2 = counter.windowed();

      // Assert
      expect(window1).toEqual({ disposed: 1, hits: 1, total: 1 });
      expect(window2).toEqual({ disposed: 0, hits: 0, total: 0 });
    });

    it('should calculate correct deltas across multiple windows', () => {
      // Act
      counter.countHit();
      counter.countHit();
      counter.countRead();
      const window1 = counter.windowed();
      counter.countHit();
      counter.countRead();
      counter.countRead();
      counter.countDisposed();
      const window2 = counter.windowed();

      // Assert
      expect(window1).toEqual({ disposed: 0, hits: 2, total: 1 });
      expect(window2).toEqual({ disposed: 1, hits: 1, total: 2 });
    });

    it('should return independent object instances for each window', () => {
      // Act
      counter.countHit();
      const result1 = counter.windowed();
      const result2 = counter.windowed();

      // Assert
      expect(result1).not.toBe(result2);
    });

    it('should track partial counter increments in window', () => {
      // Act
      counter.countHit();
      counter.countHit();
      counter.countHit();
      counter.countRead();
      counter.windowed();
      counter.countHit();
      counter.countRead();
      counter.countRead();
      const window = counter.windowed();

      // Assert
      expect(window).toEqual({ disposed: 0, hits: 1, total: 2 });
    });
  });

  describe('windowed and cumulative interaction', () => {
    it('should allow cumulative and windowed reads to coexist without interfering', () => {
      // Act
      counter.countHit();
      counter.countHit();
      counter.countRead();
      counter.countDisposed();
      const windowed1 = counter.windowed();
      const cumulative1 = counter.cumulative();

      // Assert
      expect(windowed1).toEqual({ disposed: 1, hits: 2, total: 1 });
      expect(cumulative1).toEqual({ disposed: 1, hits: 2, total: 1 });
    });

    it('should maintain independence of windowed and cumulative after subsequent increments', () => {
      // Act
      counter.countHit();
      counter.countRead();
      counter.windowed();
      counter.countHit();
      counter.countRead();
      const windowed = counter.windowed();
      const cumulative = counter.cumulative();

      // Assert
      expect(windowed).toEqual({ disposed: 0, hits: 1, total: 1 });
      expect(cumulative).toEqual({ disposed: 0, hits: 2, total: 2 });
    });

    it('should support multiple cumulative reads between windowed reads', () => {
      // Act
      counter.countHit();
      counter.countRead();
      counter.countDisposed();
      const cum1 = counter.cumulative();
      const cum2 = counter.cumulative();
      const windowed = counter.windowed();
      const cum3 = counter.cumulative();

      // Assert
      expect(cum1).toEqual({ disposed: 1, hits: 1, total: 1 });
      expect(cum2).toEqual({ disposed: 1, hits: 1, total: 1 });
      expect(windowed).toEqual({ disposed: 1, hits: 1, total: 1 });
      expect(cum3).toEqual({ disposed: 1, hits: 1, total: 1 });
    });

    it('windowed should report same values as cumulative for first window', () => {
      // Act
      counter.countHit();
      counter.countHit();
      counter.countRead();
      counter.countRead();
      counter.countRead();
      counter.countDisposed();
      const windowed = counter.windowed();
      const cumulative = counter.cumulative();

      // Assert
      expect(windowed).toEqual(cumulative);
    });
  });

  describe('large numbers', () => {
    it('should handle large hit counts', () => {
      // Act
      for (let i = 0; i < 1000000; i++) {
        counter.countHit();
      }
      const result = counter.cumulative();

      // Assert
      expect(result.hits).toBe(1000000);
    });

    it('should handle large total counts', () => {
      // Act
      for (let i = 0; i < 500000; i++) {
        counter.countRead();
      }
      const result = counter.cumulative();

      // Assert
      expect(result.total).toBe(500000);
    });

    it('should handle large disposed counts', () => {
      // Act
      for (let i = 0; i < 100000; i++) {
        counter.countDisposed();
      }
      const result = counter.cumulative();

      // Assert
      expect(result.disposed).toBe(100000);
    });

    it('should calculate correct deltas with large numbers', () => {
      // Act
      for (let i = 0; i < 100000; i++) {
        counter.countHit();
      }
      const window1 = counter.windowed();
      for (let i = 0; i < 50000; i++) {
        counter.countHit();
      }
      const window2 = counter.windowed();

      // Assert
      expect(window1.hits).toBe(100000);
      expect(window2.hits).toBe(50000);
    });
  });

  describe('edge case sequences', () => {
    it('should handle alternating increments and windows', () => {
      // Act & Assert
      counter.countHit();
      expect(counter.windowed()).toEqual({ disposed: 0, hits: 1, total: 0 });
      counter.countRead();
      expect(counter.windowed()).toEqual({ disposed: 0, hits: 0, total: 1 });
      counter.countDisposed();
      expect(counter.windowed()).toEqual({ disposed: 1, hits: 0, total: 0 });
    });

    it('should return correct cumulative after complex sequence', () => {
      // Act
      counter.countHit();
      counter.countRead();
      counter.windowed();
      counter.countHit();
      counter.countHit();
      counter.countRead();
      counter.countDisposed();
      counter.windowed();
      const cumulative = counter.cumulative();

      // Assert
      expect(cumulative).toEqual({ disposed: 1, hits: 3, total: 2 });
    });

    it('should handle multiple sequential windows without increments', () => {
      // Act
      counter.countHit();
      counter.windowed();
      const window2 = counter.windowed();
      const window3 = counter.windowed();

      // Assert
      expect(window2).toEqual({ disposed: 0, hits: 0, total: 0 });
      expect(window3).toEqual({ disposed: 0, hits: 0, total: 0 });
    });
  });
});