/**
 * Unit tests for src/caches/typings.ts
 *
 * This file exports TypeScript type definitions and type aliases used throughout
 * the caching system. Since these are compile-time only constructs, we verify:
 * 1. Type definitions are correctly structured
 * 2. Type exports are available
 * 3. Optional properties are correctly marked
 * 4. Type compatibility and assignability
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
    it('should allow creation with value and optional maxAge', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'test-value',
        maxAge: 5000,
      };

      // Assert
      expect(result.value).toBe('test-value');
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

    it('should work with generic types (object)', () => {
      // Arrange & Act
      const result: FetchResult<{ id: number; name: string }> = {
        value: { id: 1, name: 'test' },
        maxAge: 1000,
      };

      // Assert
      expect(result.value.id).toBe(1);
      expect(result.value.name).toBe('test');
      expect(result.maxAge).toBe(1000);
    });

    it('should work with generic types (array)', () => {
      // Arrange & Act
      const result: FetchResult<string[]> = {
        value: ['a', 'b', 'c'],
      };

      // Assert
      expect(result.value).toEqual(['a', 'b', 'c']);
      expect(result.maxAge).toBeUndefined();
    });
  });

  describe('DiskStats', () => {
    it('should create valid DiskStats object with all required properties', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 100,
        total: 500,
        name: 'disk-cache-1',
      };

      // Assert
      expect(stats.hits).toBe(100);
      expect(stats.total).toBe(500);
      expect(stats.name).toBe('disk-cache-1');
    });

    it('should handle zero values', () => {
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

    it('should handle large numbers', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: Number.MAX_SAFE_INTEGER,
        total: Number.MAX_SAFE_INTEGER,
        name: 'large-cache',
      };

      // Assert
      expect(stats.hits).toBe(Number.MAX_SAFE_INTEGER);
      expect(stats.total).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('LRUStats', () => {
    it('should create valid LRUStats object with all required properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 50,
        length: 1000,
        disposedItems: 25,
        hitRate: 0.8,
        hits: 80,
        max: 100,
        name: 'lru-cache-1',
        total: 100,
      };

      // Assert
      expect(stats.itemCount).toBe(50);
      expect(stats.length).toBe(1000);
      expect(stats.disposedItems).toBe(25);
      expect(stats.hitRate).toBe(0.8);
      expect(stats.hits).toBe(80);
      expect(stats.max).toBe(100);
      expect(stats.name).toBe('lru-cache-1');
      expect(stats.total).toBe(100);
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
        name: 'empty-lru',
        total: 0,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should handle extreme hitRate values', () => {
      // Arrange & Act
      const stats1: LRUStats = {
        itemCount: 1,
        length: 100,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 100,
        name: 'zero-hit-rate',
        total: 1000,
      };

      const stats2: LRUStats = {
        itemCount: 1,
        length: 100,
        disposedItems: 0,
        hitRate: 1,
        hits: 1000,
        max: 100,
        name: 'perfect-hit-rate',
        total: 1000,
      };

      // Assert
      expect(stats1.hitRate).toBe(0);
      expect(stats2.hitRate).toBe(1);
    });
  });

  describe('CumulativeStats', () => {
    it('should create valid CumulativeStats with required properties only', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 150,
        total: 300,
      };

      // Assert
      expect(stats.hits).toBe(150);
      expect(stats.total).toBe(300);
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
      expect(stats.max).toBeUndefined();
    });

    it('should create valid CumulativeStats with all optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 150,
        total: 300,
        disposedItems: 50,
        itemCount: 100,
        length: 5000,
        max: 200,
      };

      // Assert
      expect(stats.hits).toBe(150);
      expect(stats.total).toBe(300);
      expect(stats.disposedItems).toBe(50);
      expect(stats.itemCount).toBe(100);
      expect(stats.length).toBe(5000);
      expect(stats.max).toBe(200);
    });

    it('should allow partial optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 10,
        total: 20,
        disposedItems: 5,
        itemCount: 15,
      };

      // Assert
      expect(stats.disposedItems).toBe(5);
      expect(stats.itemCount).toBe(15);
      expect(stats.length).toBeUndefined();
      expect(stats.max).toBeUndefined();
    });

    it('should handle zero values for all properties', () => {
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
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.disposedItems).toBe(0);
      expect(stats.itemCount).toBe(0);
      expect(stats.length).toBe(0);
      expect(stats.max).toBe(0);
    });
  });

  describe('MultilayerStats', () => {
    it('should create valid MultilayerStats with all properties', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.75,
        hits: 150,
        total: 200,
        name: 'multilayer-cache',
      };

      // Assert
      expect(stats.hitRate).toBe(0.75);
      expect(stats.hits).toBe(150);
      expect(stats.total).toBe(200);
      expect(stats.name).toBe('multilayer-cache');
    });

    it('should allow hitRate to be undefined', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'unknown-hit-rate',
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should handle perfect and zero hit rates', () => {
      // Arrange & Act
      const perfectHits: MultilayerStats = {
        hitRate: 1,
        hits: 500,
        total: 500,
        name: 'perfect',
      };

      const zeroHits: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 500,
        name: 'zero',
      };

      // Assert
      expect(perfectHits.hitRate).toBe(1);
      expect(zeroHits.hitRate).toBe(0);
    });
  });

  describe('LRUDiskCacheOptions', () => {
    it('should create empty options object', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should create options with max property', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 1000,
      };

      // Assert
      expect(options.max).toBe(1000);
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should create options with maxAge property', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 60000,
      };

      // Assert
      expect(options.maxAge).toBe(60000);
      expect(options.max).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should create options with stale property', () => {
      // Arrange & Act
      const optionsTrue: LRUDiskCacheOptions = {
        stale: true,
      };

      const optionsFalse: LRUDiskCacheOptions = {
        stale: false,
      };

      // Assert
      expect(optionsTrue.stale).toBe(true);
      expect(optionsFalse.stale).toBe(false);
    });

    it('should create options with all properties', () => {
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

    it('should create options with multiple combinations', () => {
      // Arrange & Act
      const options1: LRUDiskCacheOptions = {
        max: 2000,
        stale: false,
      };

      const options2: LRUDiskCacheOptions = {
        maxAge: 15000,
        stale: true,
      };

      const options3: LRUDiskCacheOptions = {
        max: 3000,
        maxAge: 45000,
      };

      // Assert
      expect(options1.max).toBe(2000);
      expect(options1.stale).toBe(false);
      expect(options1.maxAge).toBeUndefined();

      expect(options2.maxAge).toBe(15000);
      expect(options2.stale).toBe(true);
      expect(options2.max).toBeUndefined();

      expect(options3.max).toBe(3000);
      expect(options3.maxAge).toBe(45000);
      expect(options3.stale).toBeUndefined();
    });

    it('should handle Infinity for max property', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Infinity,
      };

      // Assert
      expect(options.max).toBe(Infinity);
    });

    it('should handle zero values', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 0,
        maxAge: 0,
      };

      // Assert
      expect(options.max).toBe(0);
      expect(options.maxAge).toBe(0);
    });

    it('should handle large numbers for max and maxAge', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Number.MAX_SAFE_INTEGER,
        maxAge: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(options.max).toBe(Number.MAX_SAFE_INTEGER);
      expect(options.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Type exports verification', () => {
    it('should export FetchResult type', () => {
      // Arrange & Act & Assert
      const fetchResult: FetchResult<string> = { value: 'test' };
      expect(fetchResult).toBeDefined();
    });

    it('should export DiskStats type', () => {
      // Arrange & Act & Assert
      const diskStats: DiskStats = { hits: 1, total: 2, name: 'test' };
      expect(diskStats).toBeDefined();
    });

    it('should export LRUStats type', () => {
      // Arrange & Act & Assert
      const lruStats: LRUStats = {
        itemCount: 1,
        length: 2,
        disposedItems: 3,
        hitRate: 0.5,
        hits: 4,
        max: 5,
        name: 'test',
        total: 6,
      };
      expect(lruStats).toBeDefined();
    });

    it('should export CumulativeStats type', () => {
      // Arrange & Act & Assert
      const cumulativeStats: CumulativeStats = { hits: 1, total: 2 };
      expect(cumulativeStats).toBeDefined();
    });

    it('should export MultilayerStats type', () => {
      // Arrange & Act & Assert
      const multilayerStats: MultilayerStats = {
        hitRate: 0.5,
        hits: 1,
        total: 2,
        name: 'test',
      };
      expect(multilayerStats).toBeDefined();
    });

    it('should export LRUDiskCacheOptions type', () => {
      // Arrange & Act & Assert
      const options: LRUDiskCacheOptions = { max: 100 };
      expect(options).toBeDefined();
    });
  });
});
