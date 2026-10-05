/**
 * Unit tests for src/caches/typings.ts
 *
 * This file contains TypeScript type definitions and should be tested
 * to ensure types are correctly structured and exported.
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
  describe('FetchResult<V> type', () => {
    it('should accept a value and optional maxAge', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'test-value',
        maxAge: 5000,
      };

      // Assert
      expect(result.value).toBe('test-value');
      expect(result.maxAge).toBe(5000);
    });

    it('should accept a value without maxAge', () => {
      // Arrange & Act
      const result: FetchResult<number> = {
        value: 42,
      };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBeUndefined();
    });

    it('should support generic types', () => {
      // Arrange & Act
      const objectResult: FetchResult<{ id: number; name: string }> = {
        value: { id: 1, name: 'test' },
        maxAge: 1000,
      };

      // Assert
      expect(objectResult.value.id).toBe(1);
      expect(objectResult.value.name).toBe('test');
    });

    it('should support array types', () => {
      // Arrange & Act
      const arrayResult: FetchResult<string[]> = {
        value: ['a', 'b', 'c'],
        maxAge: 2000,
      };

      // Assert
      expect(arrayResult.value).toEqual(['a', 'b', 'c']);
    });

    it('should allow maxAge to be 0', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'immediate-expire',
        maxAge: 0,
      };

      // Assert
      expect(result.maxAge).toBe(0);
    });

    it('should allow maxAge to be very large', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'long-lived',
        maxAge: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(result.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('DiskStats type', () => {
    it('should have hits, total, and name properties', () => {
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

    it('should support zero values', () => {
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

    it('should support empty string name', () => {
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

  describe('LRUStats type', () => {
    it('should have all required properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 5,
        length: 1024,
        disposedItems: 2,
        hitRate: 0.75,
        hits: 150,
        max: 200,
        name: 'lru-cache',
        total: 200,
      };

      // Assert
      expect(stats.itemCount).toBe(5);
      expect(stats.length).toBe(1024);
      expect(stats.disposedItems).toBe(2);
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
        name: 'empty-lru',
        total: 0,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support hitRate value of 0', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 10,
        length: 2048,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 100,
        name: 'no-hits',
        total: 50,
      };

      // Assert
      expect(stats.hitRate).toBe(0);
    });

    it('should support hitRate value of 1', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 5,
        length: 512,
        disposedItems: 0,
        hitRate: 1,
        hits: 100,
        max: 200,
        name: 'perfect-hits',
        total: 100,
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });

    it('should support large numbers', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: Number.MAX_SAFE_INTEGER,
        length: Number.MAX_SAFE_INTEGER,
        disposedItems: Number.MAX_SAFE_INTEGER,
        hitRate: 0.99999,
        hits: Number.MAX_SAFE_INTEGER,
        max: Number.MAX_SAFE_INTEGER,
        name: 'massive-cache',
        total: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(stats.itemCount).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('CumulativeStats type', () => {
    it('should have required hits and total properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 250,
        total: 1000,
      };

      // Assert
      expect(stats.hits).toBe(250);
      expect(stats.total).toBe(1000);
    });

    it('should allow optional properties to be undefined', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 50,
        total: 100,
      };

      // Assert
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
      expect(stats.max).toBeUndefined();
    });

    it('should allow all optional properties to be defined', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 100,
        total: 200,
        disposedItems: 5,
        itemCount: 20,
        length: 2048,
        max: 500,
      };

      // Assert
      expect(stats.disposedItems).toBe(5);
      expect(stats.itemCount).toBe(20);
      expect(stats.length).toBe(2048);
      expect(stats.max).toBe(500);
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
    });
  });

  describe('MultilayerStats type', () => {
    it('should have all required properties', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.85,
        hits: 425,
        total: 500,
        name: 'multilayer-cache',
      };

      // Assert
      expect(stats.hitRate).toBe(0.85);
      expect(stats.hits).toBe(425);
      expect(stats.total).toBe(500);
      expect(stats.name).toBe('multilayer-cache');
    });

    it('should allow hitRate to be undefined', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'undefined-hitrate',
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support hitRate boundary values', () => {
      // Arrange & Act
      const statsLow: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 100,
        name: 'zero-hitrate',
      };

      const statsHigh: MultilayerStats = {
        hitRate: 1,
        hits: 100,
        total: 100,
        name: 'perfect-hitrate',
      };

      // Assert
      expect(statsLow.hitRate).toBe(0);
      expect(statsHigh.hitRate).toBe(1);
    });

    it('should support empty name string', () => {
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
  });

  describe('LRUDiskCacheOptions type', () => {
    it('should allow all properties to be undefined', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should accept max option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 1000,
      };

      // Assert
      expect(options.max).toBe(1000);
    });

    it('should accept maxAge option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 60000,
      };

      // Assert
      expect(options.maxAge).toBe(60000);
    });

    it('should accept stale option as true', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: true,
      };

      // Assert
      expect(options.stale).toBe(true);
    });

    it('should accept stale option as false', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: false,
      };

      // Assert
      expect(options.stale).toBe(false);
    });

    it('should accept all options together', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 5000,
        maxAge: 300000,
        stale: true,
      };

      // Assert
      expect(options.max).toBe(5000);
      expect(options.maxAge).toBe(300000);
      expect(options.stale).toBe(true);
    });

    it('should support max value of 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 0,
      };

      // Assert
      expect(options.max).toBe(0);
    });

    it('should support maxAge value of 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 0,
      };

      // Assert
      expect(options.maxAge).toBe(0);
    });

    it('should support Infinity as max value', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Infinity,
      };

      // Assert
      expect(options.max).toBe(Infinity);
    });

    it('should support very large max and maxAge values', () => {
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

  describe('Type exports and definitions', () => {
    it('should export FetchResult type', () => {
      // Arrange & Act
      const result: FetchResult<any> = { value: null };

      // Assert
      expect(result).toBeDefined();
    });

    it('should export DiskStats type', () => {
      // Arrange & Act
      const stats: DiskStats = { hits: 0, total: 0, name: 'test' };

      // Assert
      expect(stats).toBeDefined();
    });

    it('should export LRUStats type', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: undefined,
        hits: 0,
        max: 0,
        name: 'test',
        total: 0,
      };

      // Assert
      expect(stats).toBeDefined();
    });

    it('should export CumulativeStats type', () => {
      // Arrange & Act
      const stats: CumulativeStats = { hits: 0, total: 0 };

      // Assert
      expect(stats).toBeDefined();
    });

    it('should export MultilayerStats type', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'test',
      };

      // Assert
      expect(stats).toBeDefined();
    });

    it('should export LRUDiskCacheOptions type', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options).toBeDefined();
    });
  });
});
