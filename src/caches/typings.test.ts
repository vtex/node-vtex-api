/**
 * Unit tests for src/caches/typings.ts
 * 
 * This file contains TypeScript type definitions and does not export any runtime code.
 * Tests verify that the exported types are properly defined and can be used correctly.
 */

import {
  FetchResult,
  DiskStats,
  LRUStats,
  CumulativeStats,
  MultilayerStats,
  LRUDiskCacheOptions,
} from './typings';

describe('typings.ts - Type Definitions', () => {
  describe('FetchResult type', () => {
    it('should allow creation with value and maxAge', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'test',
        maxAge: 5000,
      };

      // Assert
      expect(result.value).toBe('test');
      expect(result.maxAge).toBe(5000);
    });

    it('should allow creation with value only (maxAge optional)', () => {
      // Arrange & Act
      const result: FetchResult<number> = {
        value: 42,
      };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBeUndefined();
    });

    it('should work with generic types', () => {
      // Arrange & Act
      const objectResult: FetchResult<{ id: number; name: string }> = {
        value: { id: 1, name: 'test' },
        maxAge: 3000,
      };

      // Assert
      expect(objectResult.value.id).toBe(1);
      expect(objectResult.value.name).toBe('test');
      expect(objectResult.maxAge).toBe(3000);
    });

    it('should work with array types', () => {
      // Arrange & Act
      const arrayResult: FetchResult<string[]> = {
        value: ['a', 'b', 'c'],
        maxAge: 1000,
      };

      // Assert
      expect(arrayResult.value).toEqual(['a', 'b', 'c']);
      expect(arrayResult.maxAge).toBe(1000);
    });
  });

  describe('DiskStats type', () => {
    it('should allow creation with all properties', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 100,
        total: 500,
        name: 'disk-cache',
      };

      // Assert
      expect(stats.hits).toBe(100);
      expect(stats.total).toBe(500);
      expect(stats.name).toBe('disk-cache');
    });

    it('should work with zero values', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 0,
        total: 0,
        name: 'empty',
      };

      // Assert
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should work with large numbers', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: Number.MAX_SAFE_INTEGER,
        total: Number.MAX_SAFE_INTEGER,
        name: 'large',
      };

      // Assert
      expect(stats.hits).toBe(Number.MAX_SAFE_INTEGER);
      expect(stats.total).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('LRUStats type', () => {
    it('should allow creation with all properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 50,
        length: 1024,
        disposedItems: 10,
        hitRate: 0.8,
        hits: 80,
        max: 100,
        name: 'lru-cache',
        total: 100,
      };

      // Assert
      expect(stats.itemCount).toBe(50);
      expect(stats.length).toBe(1024);
      expect(stats.disposedItems).toBe(10);
      expect(stats.hitRate).toBe(0.8);
      expect(stats.hits).toBe(80);
      expect(stats.max).toBe(100);
      expect(stats.name).toBe('lru-cache');
      expect(stats.total).toBe(100);
    });

    it('should allow hitRate as undefined', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: undefined,
        hits: 0,
        max: 100,
        name: 'empty-lru',
        total: 0,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should work with zero and edge case values', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 0,
        name: 'zero',
        total: 0,
      };

      // Assert
      expect(stats.itemCount).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should allow hitRate value of 1', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 100,
        length: 5120,
        disposedItems: 0,
        hitRate: 1,
        hits: 100,
        max: 100,
        name: 'perfect-hit',
        total: 100,
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });
  });

  describe('CumulativeStats type', () => {
    it('should allow creation with required properties only', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 150,
        total: 200,
      };

      // Assert
      expect(stats.hits).toBe(150);
      expect(stats.total).toBe(200);
      expect(stats.misses).toBeUndefined();
    });

    it('should allow creation with all optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 150,
        total: 200,
        misses: 50,
        disposedItems: 5,
        itemCount: 100,
        length: 2048,
        max: 200,
      };

      // Assert
      expect(stats.hits).toBe(150);
      expect(stats.total).toBe(200);
      expect(stats.misses).toBe(50);
      expect(stats.disposedItems).toBe(5);
      expect(stats.itemCount).toBe(100);
      expect(stats.length).toBe(2048);
      expect(stats.max).toBe(200);
    });

    it('should allow partial optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 300,
        misses: 100,
        itemCount: 75,
      };

      // Assert
      expect(stats.misses).toBe(100);
      expect(stats.itemCount).toBe(75);
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.length).toBeUndefined();
    });
  });

  describe('MultilayerStats type', () => {
    it('should allow creation with all properties', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.75,
        hits: 75,
        total: 100,
        name: 'multilayer',
      };

      // Assert
      expect(stats.hitRate).toBe(0.75);
      expect(stats.hits).toBe(75);
      expect(stats.total).toBe(100);
      expect(stats.name).toBe('multilayer');
    });

    it('should allow hitRate as undefined', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'empty-multilayer',
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should work with various numeric hit rates', () => {
      // Arrange
      const testCases = [0, 0.1, 0.5, 0.9, 1];

      // Act & Assert
      testCases.forEach((rate) => {
        const stats: MultilayerStats = {
          hitRate: rate,
          hits: Math.floor(rate * 100),
          total: 100,
          name: `multilayer-${rate}`,
        };
        expect(stats.hitRate).toBe(rate);
      });
    });
  });

  describe('LRUDiskCacheOptions type', () => {
    it('should allow empty options object', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should allow max option only', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 1000,
      };

      // Assert
      expect(options.max).toBe(1000);
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should allow maxAge option only', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 60000,
      };

      // Assert
      expect(options.maxAge).toBe(60000);
      expect(options.max).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should allow stale option only', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: true,
      };

      // Assert
      expect(options.stale).toBe(true);
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
    });

    it('should allow all options together', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 5000,
        maxAge: 30000,
        stale: true,
      };

      // Assert
      expect(options.max).toBe(5000);
      expect(options.maxAge).toBe(30000);
      expect(options.stale).toBe(true);
    });

    it('should allow stale as false', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: false,
      };

      // Assert
      expect(options.stale).toBe(false);
    });

    it('should work with zero and small max values', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 0,
        maxAge: 0,
      };

      // Assert
      expect(options.max).toBe(0);
      expect(options.maxAge).toBe(0);
    });

    it('should work with large max values', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Infinity,
        maxAge: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(options.max).toBe(Infinity);
      expect(options.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Type compatibility and composition', () => {
    it('should allow combining multiple stat types', () => {
      // Arrange & Act
      const diskStats: DiskStats = {
        hits: 100,
        total: 500,
        name: 'disk',
      };

      const lruStats: LRUStats = {
        itemCount: 50,
        length: 1024,
        disposedItems: 10,
        hitRate: 0.8,
        hits: 80,
        max: 100,
        name: 'lru',
        total: 100,
      };

      const cumulativeStats: CumulativeStats = {
        hits: diskStats.hits + lruStats.hits,
        total: diskStats.total + lruStats.total,
      };

      // Assert
      expect(cumulativeStats.hits).toBe(180);
      expect(cumulativeStats.total).toBe(600);
    });

    it('should allow FetchResult with complex types', () => {
      // Arrange & Act
      const complexResult: FetchResult<{
        stats: LRUStats;
        options: LRUDiskCacheOptions;
      }> = {
        value: {
          stats: {
            itemCount: 50,
            length: 1024,
            disposedItems: 10,
            hitRate: 0.8,
            hits: 80,
            max: 100,
            name: 'complex',
            total: 100,
          },
          options: {
            max: 5000,
            maxAge: 30000,
            stale: true,
          },
        },
        maxAge: 15000,
      };

      // Assert
      expect(complexResult.value.stats.hitRate).toBe(0.8);
      expect(complexResult.value.options.stale).toBe(true);
      expect(complexResult.maxAge).toBe(15000);
    });
  });
});
