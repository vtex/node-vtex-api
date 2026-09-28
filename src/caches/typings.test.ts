/**
 * Unit tests for src/caches/typings.ts
 * 
 * This file contains type definitions for cache-related structures.
 * These tests validate the type definitions and their exported contracts.
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
    it('should create a FetchResult with value and no maxAge', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'test-value',
      };

      // Assert
      expect(result.value).toBe('test-value');
      expect(result.maxAge).toBeUndefined();
    });

    it('should create a FetchResult with value and maxAge', () => {
      // Arrange & Act
      const result: FetchResult<number> = {
        value: 42,
        maxAge: 5000,
      };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBe(5000);
    });

    it('should support generic types for value property', () => {
      // Arrange & Act
      const objectResult: FetchResult<{ key: string }> = {
        value: { key: 'object-value' },
        maxAge: 3000,
      };

      // Assert
      expect(objectResult.value).toEqual({ key: 'object-value' });
      expect(objectResult.maxAge).toBe(3000);
    });

    it('should support array types for value property', () => {
      // Arrange & Act
      const arrayResult: FetchResult<number[]> = {
        value: [1, 2, 3],
      };

      // Assert
      expect(arrayResult.value).toEqual([1, 2, 3]);
    });

    it('should allow maxAge to be 0', () => {
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
    it('should create DiskStats with all required properties', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 10,
        total: 20,
        name: 'disk-cache',
      };

      // Assert
      expect(stats.hits).toBe(10);
      expect(stats.total).toBe(20);
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

    it('should allow large numerical values', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 1000000,
        total: 2000000,
        name: 'large-cache',
      };

      // Assert
      expect(stats.hits).toBe(1000000);
      expect(stats.total).toBe(2000000);
    });

    it('should support various name formats', () => {
      // Arrange & Act
      const stats1: DiskStats = { hits: 5, total: 10, name: '' };
      const stats2: DiskStats = { hits: 5, total: 10, name: 'cache-with-dashes' };
      const stats3: DiskStats = { hits: 5, total: 10, name: 'cache_with_underscores' };

      // Assert
      expect(stats1.name).toBe('');
      expect(stats2.name).toBe('cache-with-dashes');
      expect(stats3.name).toBe('cache_with_underscores');
    });
  });

  describe('LRUStats', () => {
    it('should create LRUStats with all required properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 5,
        length: 500,
        disposedItems: 2,
        hitRate: 0.75,
        hits: 15,
        max: 1000,
        name: 'lru-cache',
        total: 20,
      };

      // Assert
      expect(stats.itemCount).toBe(5);
      expect(stats.length).toBe(500);
      expect(stats.disposedItems).toBe(2);
      expect(stats.hitRate).toBe(0.75);
      expect(stats.hits).toBe(15);
      expect(stats.max).toBe(1000);
      expect(stats.name).toBe('lru-cache');
      expect(stats.total).toBe(20);
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

    it('should allow hitRate to be 0', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 5,
        length: 500,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 1000,
        name: 'no-hits',
        total: 10,
      };

      // Assert
      expect(stats.hitRate).toBe(0);
    });

    it('should allow hitRate to be 1', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 10,
        length: 1000,
        disposedItems: 0,
        hitRate: 1,
        hits: 10,
        max: 2000,
        name: 'perfect-hit-rate',
        total: 10,
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });

    it('should support fractional hitRate values', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 3,
        length: 300,
        disposedItems: 1,
        hitRate: 0.3333333333,
        hits: 3,
        max: 500,
        name: 'fractional-rate',
        total: 9,
      };

      // Assert
      expect(stats.hitRate).toBe(0.3333333333);
    });
  });

  describe('CumulativeStats', () => {
    it('should create CumulativeStats with required properties only', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 50,
        total: 100,
      };

      // Assert
      expect(stats.hits).toBe(50);
      expect(stats.total).toBe(100);
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
      expect(stats.max).toBeUndefined();
    });

    it('should create CumulativeStats with all optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 50,
        total: 100,
        disposedItems: 5,
        itemCount: 10,
        length: 1000,
        max: 2000,
      };

      // Assert
      expect(stats.hits).toBe(50);
      expect(stats.total).toBe(100);
      expect(stats.disposedItems).toBe(5);
      expect(stats.itemCount).toBe(10);
      expect(stats.length).toBe(1000);
      expect(stats.max).toBe(2000);
    });

    it('should allow partial optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 25,
        total: 50,
        disposedItems: 3,
        max: 500,
      };

      // Assert
      expect(stats.disposedItems).toBe(3);
      expect(stats.max).toBe(500);
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
    });

    it('should allow zero values for all properties', () => {
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
    it('should create MultilayerStats with all required properties', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.85,
        hits: 85,
        total: 100,
        name: 'multilayer-cache',
      };

      // Assert
      expect(stats.hitRate).toBe(0.85);
      expect(stats.hits).toBe(85);
      expect(stats.total).toBe(100);
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

    it('should allow hitRate to be 0', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 10,
        name: 'zero-hits',
      };

      // Assert
      expect(stats.hitRate).toBe(0);
    });

    it('should allow hitRate to be 1', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 1,
        hits: 50,
        total: 50,
        name: 'perfect-multilayer',
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });

    it('should support various name formats', () => {
      // Arrange & Act
      const stats1: MultilayerStats = { hitRate: 0.5, hits: 5, total: 10, name: '' };
      const stats2: MultilayerStats = { hitRate: 0.5, hits: 5, total: 10, name: 'l1-l2-l3' };

      // Assert
      expect(stats1.name).toBe('');
      expect(stats2.name).toBe('l1-l2-l3');
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

    it('should allow setting max option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 1000,
      };

      // Assert
      expect(options.max).toBe(1000);
    });

    it('should allow setting maxAge option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 60000,
      };

      // Assert
      expect(options.maxAge).toBe(60000);
    });

    it('should allow setting stale option to true', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: true,
      };

      // Assert
      expect(options.stale).toBe(true);
    });

    it('should allow setting stale option to false', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: false,
      };

      // Assert
      expect(options.stale).toBe(false);
    });

    it('should allow setting all options together', () => {
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

    it('should allow max to be Infinity', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Infinity,
      };

      // Assert
      expect(options.max).toBe(Infinity);
    });

    it('should allow max to be 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 0,
      };

      // Assert
      expect(options.max).toBe(0);
    });

    it('should allow maxAge to be 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 0,
      };

      // Assert
      expect(options.maxAge).toBe(0);
    });

    it('should allow large maxAge values', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 1000000000,
      };

      // Assert
      expect(options.maxAge).toBe(1000000000);
    });

    it('should support partial option combinations', () => {
      // Arrange & Act
      const options1: LRUDiskCacheOptions = { max: 100, stale: true };
      const options2: LRUDiskCacheOptions = { maxAge: 5000, stale: false };

      // Assert
      expect(options1.max).toBe(100);
      expect(options1.stale).toBe(true);
      expect(options1.maxAge).toBeUndefined();
      expect(options2.maxAge).toBe(5000);
      expect(options2.stale).toBe(false);
      expect(options2.max).toBeUndefined();
    });
  });

  describe('Type Compatibility and Structure', () => {
    it('should maintain type safety across all type definitions', () => {
      // Arrange & Act
      const fetchResult: FetchResult<string> = { value: 'test', maxAge: 1000 };
      const diskStats: DiskStats = { hits: 1, total: 2, name: 'test' };
      const lruStats: LRUStats = {
        itemCount: 1,
        length: 100,
        disposedItems: 0,
        hitRate: 0.5,
        hits: 1,
        max: 1000,
        name: 'test',
        total: 2,
      };
      const cumulativeStats: CumulativeStats = { hits: 1, total: 2 };
      const multilayerStats: MultilayerStats = { hitRate: 0.5, hits: 1, total: 2, name: 'test' };
      const options: LRUDiskCacheOptions = { max: 1000, maxAge: 5000, stale: true };

      // Assert - all types compile and exist
      expect(fetchResult).toBeDefined();
      expect(diskStats).toBeDefined();
      expect(lruStats).toBeDefined();
      expect(cumulativeStats).toBeDefined();
      expect(multilayerStats).toBeDefined();
      expect(options).toBeDefined();
    });
  });
});
