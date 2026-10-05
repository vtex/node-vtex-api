/**
 * Unit tests for src/caches/typings.ts
 *
 * This file exports TypeScript type definitions for cache-related structures.
 * Since these are purely type definitions with no runtime behavior, we verify:
 * - Type definitions are properly exported
 * - Type structure matches expected shape
 * - Optional fields are correctly marked
 */

import type {
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
        value: 'test-value',
        maxAge: 1000,
      };

      // Assert
      expect(result.value).toBe('test-value');
      expect(result.maxAge).toBe(1000);
    });

    it('should allow creating a FetchResult with only value', () => {
      // Arrange & Act
      const result: FetchResult<number> = {
        value: 42,
      };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBeUndefined();
    });

    it('should support generic types for value', () => {
      // Arrange & Act
      const objectResult: FetchResult<{ id: number; name: string }> = {
        value: { id: 1, name: 'test' },
        maxAge: 500,
      };

      // Assert
      expect(objectResult.value.id).toBe(1);
      expect(objectResult.value.name).toBe('test');
    });

    it('should support array types for value', () => {
      // Arrange & Act
      const arrayResult: FetchResult<string[]> = {
        value: ['a', 'b', 'c'],
      };

      // Assert
      expect(arrayResult.value).toEqual(['a', 'b', 'c']);
    });
  });

  describe('DiskStats', () => {
    it('should create DiskStats with all required fields', () => {
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

    it('should support large numeric values', () => {
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
    it('should create LRUStats with all required fields', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 50,
        length: 1000,
        disposedItems: 10,
        hitRate: 0.85,
        hits: 425,
        max: 500,
        name: 'lru-cache',
        total: 500,
      };

      // Assert
      expect(stats.itemCount).toBe(50);
      expect(stats.length).toBe(1000);
      expect(stats.disposedItems).toBe(10);
      expect(stats.hitRate).toBe(0.85);
      expect(stats.hits).toBe(425);
      expect(stats.max).toBe(500);
      expect(stats.name).toBe('lru-cache');
      expect(stats.total).toBe(500);
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
        name: 'new-cache',
        total: 0,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support hitRate as 0 and 1', () => {
      // Arrange & Act
      const zeroHitRate: LRUStats = {
        itemCount: 10,
        length: 100,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 100,
        name: 'no-hits',
        total: 10,
      };

      const perfectHitRate: LRUStats = {
        itemCount: 10,
        length: 100,
        disposedItems: 0,
        hitRate: 1,
        hits: 10,
        max: 100,
        name: 'all-hits',
        total: 10,
      };

      // Assert
      expect(zeroHitRate.hitRate).toBe(0);
      expect(perfectHitRate.hitRate).toBe(1);
    });
  });

  describe('CumulativeStats', () => {
    it('should create CumulativeStats with all optional fields', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 1000,
        misses: 800,
        disposedItems: 50,
        itemCount: 150,
        length: 5000,
        max: 10000,
      };

      // Assert
      expect(stats.hits).toBe(200);
      expect(stats.total).toBe(1000);
      expect(stats.misses).toBe(800);
      expect(stats.disposedItems).toBe(50);
      expect(stats.itemCount).toBe(150);
      expect(stats.length).toBe(5000);
      expect(stats.max).toBe(10000);
    });

    it('should allow empty CumulativeStats object', () => {
      // Arrange & Act
      const stats: CumulativeStats = {};

      // Assert
      expect(stats.hits).toBeUndefined();
      expect(stats.total).toBeUndefined();
      expect(stats.misses).toBeUndefined();
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
      expect(stats.max).toBeUndefined();
    });

    it('should allow partial CumulativeStats with specific fields', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 100,
        misses: 50,
      };

      // Assert
      expect(stats.hits).toBe(100);
      expect(stats.misses).toBe(50);
      expect(stats.total).toBeUndefined();
      expect(stats.disposedItems).toBeUndefined();
    });

    it('should support zero values for all fields', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 0,
        total: 0,
        misses: 0,
        disposedItems: 0,
        itemCount: 0,
        length: 0,
        max: 0,
      };

      // Assert
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('MultilayerStats', () => {
    it('should create MultilayerStats with all required fields', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.75,
        hits: 300,
        total: 400,
        name: 'multi-layer',
      };

      // Assert
      expect(stats.hitRate).toBe(0.75);
      expect(stats.hits).toBe(300);
      expect(stats.total).toBe(400);
      expect(stats.name).toBe('multi-layer');
    });

    it('should allow hitRate to be undefined', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'new-multi-layer',
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support various hitRate values', () => {
      // Arrange & Act
      const stats1: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 10,
        name: 'zero-hits',
      };

      const stats2: MultilayerStats = {
        hitRate: 1,
        hits: 100,
        total: 100,
        name: 'perfect-hits',
      };

      const stats3: MultilayerStats = {
        hitRate: 0.5,
        hits: 50,
        total: 100,
        name: 'half-hits',
      };

      // Assert
      expect(stats1.hitRate).toBe(0);
      expect(stats2.hitRate).toBe(1);
      expect(stats3.hitRate).toBe(0.5);
    });
  });

  describe('LRUDiskCacheOptions', () => {
    it('should create LRUDiskCacheOptions with all optional fields', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 1000,
        maxAge: 60000,
        stale: true,
      };

      // Assert
      expect(options.max).toBe(1000);
      expect(options.maxAge).toBe(60000);
      expect(options.stale).toBe(true);
    });

    it('should allow empty LRUDiskCacheOptions object', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should allow only max option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 5000,
      };

      // Assert
      expect(options.max).toBe(5000);
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should allow only maxAge option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 30000,
      };

      // Assert
      expect(options.maxAge).toBe(30000);
      expect(options.max).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should allow only stale option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: false,
      };

      // Assert
      expect(options.stale).toBe(false);
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
    });

    it('should support stale as false', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 100,
        maxAge: 5000,
        stale: false,
      };

      // Assert
      expect(options.stale).toBe(false);
    });

    it('should support stale as true', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 100,
        maxAge: 5000,
        stale: true,
      };

      // Assert
      expect(options.stale).toBe(true);
    });

    it('should support zero and large values for max', () => {
      // Arrange & Act
      const optionsZero: LRUDiskCacheOptions = {
        max: 0,
      };

      const optionsLarge: LRUDiskCacheOptions = {
        max: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(optionsZero.max).toBe(0);
      expect(optionsLarge.max).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should support zero and large values for maxAge', () => {
      // Arrange & Act
      const optionsZero: LRUDiskCacheOptions = {
        maxAge: 0,
      };

      const optionsLarge: LRUDiskCacheOptions = {
        maxAge: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(optionsZero.maxAge).toBe(0);
      expect(optionsLarge.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Type Compatibility', () => {
    it('should allow FetchResult to be used interchangeably with compatible types', () => {
      // Arrange & Act
      const result: FetchResult<{ id: number }> = {
        value: { id: 123 },
        maxAge: 1000,
      };

      const extracted = result.value;

      // Assert
      expect(extracted.id).toBe(123);
    });

    it('should allow composing types with different generics', () => {
      // Arrange & Act
      const stringResult: FetchResult<string> = {
        value: 'test',
      };

      const numberResult: FetchResult<number> = {
        value: 42,
      };

      const objectResult: FetchResult<{ key: string }> = {
        value: { key: 'value' },
      };

      // Assert
      expect(typeof stringResult.value).toBe('string');
      expect(typeof numberResult.value).toBe('number');
      expect(typeof objectResult.value).toBe('object');
    });
  });
});
