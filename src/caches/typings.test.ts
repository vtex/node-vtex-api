/**
 * Unit tests for src/caches/typings.ts
 *
 * This file exports TypeScript type definitions and interfaces for cache-related
 * functionality. Since these are pure type definitions with no runtime behavior,
 * tests verify that the types are correctly structured and can be instantiated
 * with valid data.
 */

import type {
  FetchResult,
  DiskStats,
  LRUStats,
  CumulativeStats,
  MultilayerStats,
  LRUDiskCacheOptions,
} from './typings';

describe('typings', () => {
  describe('FetchResult<V>', () => {
    it('should allow creating a FetchResult with only a value', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'test-value',
      };

      // Assert
      expect(result.value).toBe('test-value');
      expect(result.maxAge).toBeUndefined();
    });

    it('should allow creating a FetchResult with value and maxAge', () => {
      // Arrange & Act
      const result: FetchResult<number> = {
        value: 42,
        maxAge: 5000,
      };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBe(5000);
    });

    it('should support generic types with objects', () => {
      // Arrange
      const testData = { id: 1, name: 'test' };

      // Act
      const result: FetchResult<typeof testData> = {
        value: testData,
        maxAge: 3000,
      };

      // Assert
      expect(result.value).toEqual(testData);
      expect(result.maxAge).toBe(3000);
    });

    it('should support generic types with arrays', () => {
      // Arrange
      const testArray = [1, 2, 3];

      // Act
      const result: FetchResult<number[]> = {
        value: testArray,
      };

      // Assert
      expect(result.value).toEqual(testArray);
    });

    it('should allow maxAge of zero', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'expired',
        maxAge: 0,
      };

      // Assert
      expect(result.maxAge).toBe(0);
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

    it('should allow zero values for hits and total', () => {
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

    it('should allow empty string for name', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 10,
        total: 20,
        name: '',
      };

      // Assert
      expect(stats.name).toBe('');
    });

    it('should allow large numeric values', () => {
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
        name: 'empty-lru',
        total: 0,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should allow hitRate of 0 (distinct from undefined)', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 10,
        length: 100,
        disposedItems: 5,
        hitRate: 0,
        hits: 0,
        max: 200,
        name: 'no-hits-lru',
        total: 100,
      };

      // Assert
      expect(stats.hitRate).toBe(0);
    });

    it('should allow hitRate of 1 (100%)', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 20,
        length: 500,
        disposedItems: 0,
        hitRate: 1,
        hits: 50,
        max: 100,
        name: 'perfect-lru',
        total: 50,
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });

    it('should allow zero values for all numeric fields except hitRate', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: undefined,
        hits: 0,
        max: 0,
        name: 'zero-lru',
        total: 0,
      };

      // Assert
      expect(stats.itemCount).toBe(0);
      expect(stats.length).toBe(0);
      expect(stats.disposedItems).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe('CumulativeStats', () => {
    it('should create CumulativeStats with only required fields', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 100,
        total: 200,
      };

      // Assert
      expect(stats.hits).toBe(100);
      expect(stats.total).toBe(200);
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
      expect(stats.max).toBeUndefined();
    });

    it('should create CumulativeStats with all optional fields', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 150,
        total: 300,
        disposedItems: 25,
        itemCount: 75,
        length: 1500,
        max: 500,
      };

      // Assert
      expect(stats.hits).toBe(150);
      expect(stats.total).toBe(300);
      expect(stats.disposedItems).toBe(25);
      expect(stats.itemCount).toBe(75);
      expect(stats.length).toBe(1500);
      expect(stats.max).toBe(500);
    });

    it('should allow partial optional fields', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 50,
        total: 100,
        disposedItems: 5,
        itemCount: 20,
      };

      // Assert
      expect(stats.hits).toBe(50);
      expect(stats.total).toBe(100);
      expect(stats.disposedItems).toBe(5);
      expect(stats.itemCount).toBe(20);
      expect(stats.length).toBeUndefined();
      expect(stats.max).toBeUndefined();
    });

    it('should allow zero values', () => {
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
    it('should create MultilayerStats with all required fields', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.75,
        hits: 300,
        total: 400,
        name: 'multilayer-cache',
      };

      // Assert
      expect(stats.hitRate).toBe(0.75);
      expect(stats.hits).toBe(300);
      expect(stats.total).toBe(400);
      expect(stats.name).toBe('multilayer-cache');
    });

    it('should allow hitRate to be undefined', () => {
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

    it('should allow hitRate of 0', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 100,
        name: 'no-hits-multilayer',
      };

      // Assert
      expect(stats.hitRate).toBe(0);
    });

    it('should allow hitRate of 1', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 1,
        hits: 200,
        total: 200,
        name: 'perfect-multilayer',
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });

    it('should allow empty string for name', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.5,
        hits: 50,
        total: 100,
        name: '',
      };

      // Assert
      expect(stats.name).toBe('');
    });

    it('should allow zero values for hits and total', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'zero-multilayer',
      };

      // Assert
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe('LRUDiskCacheOptions', () => {
    it('should create empty LRUDiskCacheOptions', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should create LRUDiskCacheOptions with max option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 1000,
      };

      // Assert
      expect(options.max).toBe(1000);
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should create LRUDiskCacheOptions with maxAge option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 60000,
      };

      // Assert
      expect(options.maxAge).toBe(60000);
      expect(options.max).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should create LRUDiskCacheOptions with stale option true', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: true,
      };

      // Assert
      expect(options.stale).toBe(true);
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
    });

    it('should create LRUDiskCacheOptions with stale option false', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: false,
      };

      // Assert
      expect(options.stale).toBe(false);
    });

    it('should create LRUDiskCacheOptions with all options', () => {
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

    it('should allow max of Infinity', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Infinity,
      };

      // Assert
      expect(options.max).toBe(Infinity);
    });

    it('should allow maxAge of 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 0,
      };

      // Assert
      expect(options.maxAge).toBe(0);
    });

    it('should allow max of 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 0,
      };

      // Assert
      expect(options.max).toBe(0);
    });

    it('should allow very large max value', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(options.max).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should allow very large maxAge value', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(options.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});
