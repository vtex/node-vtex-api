/**
 * Unit tests for src/caches/typings.ts
 *
 * This file exports TypeScript type definitions for cache-related structures.
 * Since these are type definitions (compile-time only), we test their structural
 * validity and documentation through type assertions and compile-time checks.
 */

import {
  FetchResult,
  DiskStats,
  LRUStats,
  CumulativeStats,
  MultilayerStats,
  LRUDiskCacheOptions,
} from './typings';

describe('typings', () => {
  describe('FetchResult<V>', () => {
    it('should have a value property of generic type V', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'test',
      };

      // Assert
      expect(result.value).toBe('test');
      expect(result.maxAge).toBeUndefined();
    });

    it('should optionally include maxAge property', () => {
      // Arrange & Act
      const result: FetchResult<number> = {
        value: 42,
        maxAge: 5000,
      };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBe(5000);
    });

    it('should support various generic types', () => {
      // Arrange & Act
      const objectResult: FetchResult<Record<string, unknown>> = {
        value: { key: 'value' },
      };

      const arrayResult: FetchResult<string[]> = {
        value: ['a', 'b', 'c'],
        maxAge: 1000,
      };

      // Assert
      expect(objectResult.value).toEqual({ key: 'value' });
      expect(arrayResult.value).toEqual(['a', 'b', 'c']);
      expect(arrayResult.maxAge).toBe(1000);
    });

    it('should handle zero and negative maxAge values', () => {
      // Arrange & Act
      const zeroMaxAge: FetchResult<string> = {
        value: 'test',
        maxAge: 0,
      };

      const negativeMaxAge: FetchResult<string> = {
        value: 'test',
        maxAge: -1,
      };

      // Assert
      expect(zeroMaxAge.maxAge).toBe(0);
      expect(negativeMaxAge.maxAge).toBe(-1);
    });
  });

  describe('DiskStats', () => {
    it('should have required properties: hits, total, and name', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 100,
        total: 150,
        name: 'disk-cache',
      };

      // Assert
      expect(stats.hits).toBe(100);
      expect(stats.total).toBe(150);
      expect(stats.name).toBe('disk-cache');
    });

    it('should handle zero values for hits and total', () => {
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

    it('should support empty string for name', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 5,
        total: 10,
        name: '',
      };

      // Assert
      expect(stats.name).toBe('');
    });
  });

  describe('LRUStats', () => {
    it('should have all required properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 50,
        length: 1000,
        disposedItems: 10,
        hitRate: 0.85,
        hits: 85,
        max: 100,
        name: 'lru-cache',
        total: 100,
      };

      // Assert
      expect(stats.itemCount).toBe(50);
      expect(stats.length).toBe(1000);
      expect(stats.disposedItems).toBe(10);
      expect(stats.hitRate).toBe(0.85);
      expect(stats.hits).toBe(85);
      expect(stats.max).toBe(100);
      expect(stats.name).toBe('lru-cache');
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
        name: 'test',
        total: 0,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should handle zero and boundary values', () => {
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
      expect(stats.max).toBe(0);
    });

    it('should handle fractional hitRate values', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 10,
        length: 100,
        disposedItems: 2,
        hitRate: 0.33333,
        hits: 33,
        max: 1000,
        name: 'fractional',
        total: 99,
      };

      // Assert
      expect(stats.hitRate).toBeCloseTo(0.33333, 5);
    });
  });

  describe('CumulativeStats', () => {
    it('should have required properties: hits and total', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 250,
      };

      // Assert
      expect(stats.hits).toBe(200);
      expect(stats.total).toBe(250);
    });

    it('should optionally include misses', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 250,
        misses: 50,
      };

      // Assert
      expect(stats.misses).toBe(50);
    });

    it('should optionally include disposedItems', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 250,
        disposedItems: 30,
      };

      // Assert
      expect(stats.disposedItems).toBe(30);
    });

    it('should optionally include itemCount', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 250,
        itemCount: 150,
      };

      // Assert
      expect(stats.itemCount).toBe(150);
    });

    it('should optionally include length', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 250,
        length: 5000,
      };

      // Assert
      expect(stats.length).toBe(5000);
    });

    it('should optionally include max', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 250,
        max: 1000,
      };

      // Assert
      expect(stats.max).toBe(1000);
    });

    it('should support combining multiple optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 250,
        misses: 50,
        disposedItems: 30,
        itemCount: 150,
        length: 5000,
        max: 1000,
      };

      // Assert
      expect(stats.hits).toBe(200);
      expect(stats.total).toBe(250);
      expect(stats.misses).toBe(50);
      expect(stats.disposedItems).toBe(30);
      expect(stats.itemCount).toBe(150);
      expect(stats.length).toBe(5000);
      expect(stats.max).toBe(1000);
    });

    it('should handle zero values for optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 0,
        total: 100,
        misses: 0,
        disposedItems: 0,
        itemCount: 0,
      };

      // Assert
      expect(stats.misses).toBe(0);
      expect(stats.disposedItems).toBe(0);
      expect(stats.itemCount).toBe(0);
    });
  });

  describe('MultilayerStats', () => {
    it('should have all required properties', () => {
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
        name: 'uninitialized',
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should handle zero values', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 0,
        name: 'empty',
      };

      // Assert
      expect(stats.hitRate).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should handle perfect hitRate (1.0)', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 1.0,
        hits: 100,
        total: 100,
        name: 'perfect',
      };

      // Assert
      expect(stats.hitRate).toBe(1.0);
    });
  });

  describe('LRUDiskCacheOptions', () => {
    it('should be completely optional', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should optionally include max property', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 1000,
      };

      // Assert
      expect(options.max).toBe(1000);
    });

    it('should optionally include maxAge property', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 60000,
      };

      // Assert
      expect(options.maxAge).toBe(60000);
    });

    it('should optionally include stale property', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: true,
      };

      // Assert
      expect(options.stale).toBe(true);
    });

    it('should support combining all optional properties', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 5000,
        maxAge: 30000,
        stale: false,
      };

      // Assert
      expect(options.max).toBe(5000);
      expect(options.maxAge).toBe(30000);
      expect(options.stale).toBe(false);
    });

    it('should handle stale:true to return stale values before deletion', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 5000,
        stale: true,
      };

      // Assert
      expect(options.stale).toBe(true);
      expect(options.maxAge).toBe(5000);
    });

    it('should handle stale:false to return undefined for stale entries', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 5000,
        stale: false,
      };

      // Assert
      expect(options.stale).toBe(false);
    });

    it('should support zero and Infinity values for max', () => {
      // Arrange & Act
      const zeroMax: LRUDiskCacheOptions = { max: 0 };
      const infinityMax: LRUDiskCacheOptions = { max: Infinity };

      // Assert
      expect(zeroMax.max).toBe(0);
      expect(infinityMax.max).toBe(Infinity);
    });

    it('should support zero and large values for maxAge', () => {
      // Arrange & Act
      const zeroAge: LRUDiskCacheOptions = { maxAge: 0 };
      const largeAge: LRUDiskCacheOptions = { maxAge: 86400000 }; // 1 day in ms

      // Assert
      expect(zeroAge.maxAge).toBe(0);
      expect(largeAge.maxAge).toBe(86400000);
    });
  });

  describe('Type safety and structure validation', () => {
    it('should enforce type contracts at compile time', () => {
      // This test verifies that the types are properly exported and usable
      // Arrange & Act
      const result: FetchResult<{ id: number }> = {
        value: { id: 1 },
        maxAge: 100,
      };

      const stats: DiskStats = {
        hits: 10,
        total: 20,
        name: 'test',
      };

      const options: LRUDiskCacheOptions = {
        max: 100,
        maxAge: 5000,
        stale: true,
      };

      // Assert
      expect(result).toBeDefined();
      expect(stats).toBeDefined();
      expect(options).toBeDefined();
    });
  });
});
