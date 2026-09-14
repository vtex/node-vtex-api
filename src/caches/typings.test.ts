/**
 * Unit tests for src/caches/typings.ts
 * 
 * This file exports TypeScript type definitions and interfaces.
 * Tests verify the structural correctness and TypeScript compilation of these types.
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
  describe('FetchResult<V>', () => {
    it('should allow creating a FetchResult with value and maxAge', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'test',
        maxAge: 1000,
      };

      // Assert
      expect(result.value).toBe('test');
      expect(result.maxAge).toBe(1000);
    });

    it('should allow creating a FetchResult with only value (maxAge optional)', () => {
      // Arrange & Act
      const result: FetchResult<number> = {
        value: 42,
      };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBeUndefined();
    });

    it('should support generic type with objects', () => {
      // Arrange & Act
      const result: FetchResult<{ id: number; name: string }> = {
        value: { id: 1, name: 'test' },
        maxAge: 500,
      };

      // Assert
      expect(result.value.id).toBe(1);
      expect(result.value.name).toBe('test');
      expect(result.maxAge).toBe(500);
    });

    it('should support generic type with arrays', () => {
      // Arrange & Act
      const result: FetchResult<string[]> = {
        value: ['a', 'b', 'c'],
      };

      // Assert
      expect(result.value).toEqual(['a', 'b', 'c']);
    });

    it('should support maxAge with zero value', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'immediate',
        maxAge: 0,
      };

      // Assert
      expect(result.maxAge).toBe(0);
    });

    it('should support maxAge with large numbers', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'data',
        maxAge: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(result.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('DiskStats', () => {
    it('should create DiskStats with all required properties', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 100,
        total: 200,
        name: 'disk-cache',
      };

      // Assert
      expect(stats.hits).toBe(100);
      expect(stats.total).toBe(200);
      expect(stats.name).toBe('disk-cache');
    });

    it('should support zero values for hits and total', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 0,
        total: 0,
        name: 'empty-cache',
      };

      // Assert
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should support large hit values', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 1000000,
        total: 2000000,
        name: 'busy-cache',
      };

      // Assert
      expect(stats.hits).toBe(1000000);
      expect(stats.total).toBe(2000000);
    });

    it('should support empty string names', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 10,
        total: 20,
        name: '',
      };

      // Assert
      expect(stats.name).toBe('');
    });
  });

  describe('LRUStats', () => {
    it('should create LRUStats with all required properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 50,
        length: 1000,
        disposedItems: 5,
        hitRate: 0.75,
        hits: 150,
        max: 200,
        name: 'lru-cache',
        total: 200,
      };

      // Assert
      expect(stats.itemCount).toBe(50);
      expect(stats.length).toBe(1000);
      expect(stats.disposedItems).toBe(5);
      expect(stats.hitRate).toBe(0.75);
      expect(stats.hits).toBe(150);
      expect(stats.max).toBe(200);
      expect(stats.name).toBe('lru-cache');
      expect(stats.total).toBe(200);
    });

    it('should allow hitRate to be undefined', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: undefined,
        hits: 0,
        max: 100,
        name: 'test',
        total: 0,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support zero values for all numeric properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 0,
        name: 'empty',
        total: 0,
      };

      // Assert
      expect(stats.itemCount).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should support hitRate of 1 (perfect hit rate)', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 100,
        length: 5000,
        disposedItems: 0,
        hitRate: 1,
        hits: 100,
        max: 100,
        name: 'perfect',
        total: 100,
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });

    it('should support negative hitRate (edge case)', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 50,
        length: 1000,
        disposedItems: 10,
        hitRate: -0.5,
        hits: -100,
        max: 200,
        name: 'edge',
        total: 200,
      };

      // Assert
      expect(stats.hitRate).toBe(-0.5);
    });
  });

  describe('CumulativeStats', () => {
    it('should create CumulativeStats with required properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 500,
        total: 1000,
      };

      // Assert
      expect(stats.hits).toBe(500);
      expect(stats.total).toBe(1000);
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
      expect(stats.max).toBeUndefined();
    });

    it('should create CumulativeStats with all optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 500,
        total: 1000,
        disposedItems: 50,
        itemCount: 100,
        length: 5000,
        max: 200,
      };

      // Assert
      expect(stats.hits).toBe(500);
      expect(stats.total).toBe(1000);
      expect(stats.disposedItems).toBe(50);
      expect(stats.itemCount).toBe(100);
      expect(stats.length).toBe(5000);
      expect(stats.max).toBe(200);
    });

    it('should support zero values for optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 0,
        total: 0,
        disposedItems: 0,
        itemCount: 0,
        length: 0,
        max: 0,
      };

      // Assert
      expect(stats.disposedItems).toBe(0);
      expect(stats.itemCount).toBe(0);
      expect(stats.length).toBe(0);
      expect(stats.max).toBe(0);
    });

    it('should allow partial optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 100,
        total: 200,
        disposedItems: 10,
        max: 500,
      };

      // Assert
      expect(stats.disposedItems).toBe(10);
      expect(stats.max).toBe(500);
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
    });
  });

  describe('MultilayerStats', () => {
    it('should create MultilayerStats with all required properties', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.85,
        hits: 850,
        total: 1000,
        name: 'multilayer-cache',
      };

      // Assert
      expect(stats.hitRate).toBe(0.85);
      expect(stats.hits).toBe(850);
      expect(stats.total).toBe(1000);
      expect(stats.name).toBe('multilayer-cache');
    });

    it('should allow hitRate to be undefined', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'empty',
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support zero values', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 0,
        name: 'zero',
      };

      // Assert
      expect(stats.hitRate).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should support hitRate of 1 (perfect)', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 1,
        hits: 1000,
        total: 1000,
        name: 'perfect-hit',
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });

    it('should support large hit counts', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.5,
        hits: Number.MAX_SAFE_INTEGER,
        total: Number.MAX_SAFE_INTEGER * 2,
        name: 'large-numbers',
      };

      // Assert
      expect(stats.hits).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('LRUDiskCacheOptions', () => {
    it('should create empty LRUDiskCacheOptions object', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should set max option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 1000,
      };

      // Assert
      expect(options.max).toBe(1000);
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should set maxAge option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 5000,
      };

      // Assert
      expect(options.maxAge).toBe(5000);
      expect(options.max).toBeUndefined();
    });

    it('should set stale option to true', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: true,
      };

      // Assert
      expect(options.stale).toBe(true);
    });

    it('should set stale option to false', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: false,
      };

      // Assert
      expect(options.stale).toBe(false);
    });

    it('should set all options together', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 5000,
        maxAge: 10000,
        stale: true,
      };

      // Assert
      expect(options.max).toBe(5000);
      expect(options.maxAge).toBe(10000);
      expect(options.stale).toBe(true);
    });

    it('should support max with Infinity', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Infinity,
      };

      // Assert
      expect(options.max).toBe(Infinity);
    });

    it('should support maxAge with zero', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 0,
      };

      // Assert
      expect(options.maxAge).toBe(0);
    });

    it('should support max with zero', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 0,
      };

      // Assert
      expect(options.max).toBe(0);
    });

    it('should support large maxAge values', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(options.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should support negative max (edge case)', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: -100,
      };

      // Assert
      expect(options.max).toBe(-100);
    });

    it('should support partial options with max and stale', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 2000,
        stale: false,
      };

      // Assert
      expect(options.max).toBe(2000);
      expect(options.stale).toBe(false);
      expect(options.maxAge).toBeUndefined();
    });
  });

  describe('Type Compatibility', () => {
    it('should allow FetchResult to be used in function parameters', () => {
      // Arrange
      const processor = (result: FetchResult<string>): string => result.value;

      // Act
      const result: FetchResult<string> = { value: 'test' };
      const output = processor(result);

      // Assert
      expect(output).toBe('test');
    });

    it('should allow stats objects to be used in arrays', () => {
      // Arrange & Act
      const diskStats: DiskStats[] = [
        { hits: 10, total: 20, name: 'cache1' },
        { hits: 5, total: 15, name: 'cache2' },
      ];

      // Assert
      expect(diskStats).toHaveLength(2);
      expect(diskStats[0].name).toBe('cache1');
    });

    it('should allow mixed stats objects in union structures', () => {
      // Arrange & Act
      const stats: DiskStats | LRUStats | MultilayerStats = {
        hitRate: 0.8,
        hits: 80,
        total: 100,
        name: 'test',
      };

      // Assert
      expect(stats.name).toBe('test');
      expect(stats.hits).toBe(80);
      expect(stats.total).toBe(100);
    });
  });
});