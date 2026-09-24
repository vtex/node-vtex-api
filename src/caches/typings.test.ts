/**
 * Unit tests for src/caches/typings.ts
 * 
 * This file exports TypeScript type definitions and does not contain executable code.
 * These tests verify the type definitions are correctly structured and can be used
 * in various contexts without runtime errors.
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
    it('should allow a value with maxAge', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'test',
        maxAge: 5000,
      };

      // Assert
      expect(result.value).toBe('test');
      expect(result.maxAge).toBe(5000);
    });

    it('should allow a value without maxAge', () => {
      // Arrange & Act
      const result: FetchResult<number> = {
        value: 42,
      };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBeUndefined();
    });

    it('should support generic types with objects', () => {
      // Arrange & Act
      const result: FetchResult<{ name: string; age: number }> = {
        value: { name: 'John', age: 30 },
        maxAge: 1000,
      };

      // Assert
      expect(result.value.name).toBe('John');
      expect(result.value.age).toBe(30);
      expect(result.maxAge).toBe(1000);
    });

    it('should support generic types with arrays', () => {
      // Arrange & Act
      const result: FetchResult<string[]> = {
        value: ['a', 'b', 'c'],
      };

      // Assert
      expect(result.value).toEqual(['a', 'b', 'c']);
    });

    it('should allow maxAge to be zero', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'immediate',
        maxAge: 0,
      };

      // Assert
      expect(result.maxAge).toBe(0);
    });

    it('should support null as value', () => {
      // Arrange & Act
      const result: FetchResult<null> = {
        value: null,
        maxAge: 1000,
      };

      // Assert
      expect(result.value).toBeNull();
    });
  });

  describe('DiskStats', () => {
    it('should have required properties', () => {
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

    it('should support zero hits', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 0,
        total: 100,
        name: 'cache',
      };

      // Assert
      expect(stats.hits).toBe(0);
    });

    it('should support equal hits and total', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 50,
        total: 50,
        name: 'perfect-cache',
      };

      // Assert
      expect(stats.hits).toBe(stats.total);
    });

    it('should support empty name string', () => {
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
    it('should have all required properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 50,
        length: 1000,
        disposedItems: 5,
        hitRate: 0.85,
        hits: 100,
        max: 200,
        name: 'lru-cache',
        total: 120,
      };

      // Assert
      expect(stats.itemCount).toBe(50);
      expect(stats.length).toBe(1000);
      expect(stats.disposedItems).toBe(5);
      expect(stats.hitRate).toBe(0.85);
      expect(stats.hits).toBe(100);
      expect(stats.max).toBe(200);
      expect(stats.name).toBe('lru-cache');
      expect(stats.total).toBe(120);
    });

    it('should support undefined hitRate', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 10,
        length: 500,
        disposedItems: 0,
        hitRate: undefined,
        hits: 5,
        max: 100,
        name: 'cache',
        total: 10,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support zero values', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 0,
        name: 'empty-cache',
        total: 0,
      };

      // Assert
      expect(stats.itemCount).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should support hitRate of 1 (100%)', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 5,
        length: 100,
        disposedItems: 0,
        hitRate: 1,
        hits: 50,
        max: 50,
        name: 'perfect-cache',
        total: 50,
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });
  });

  describe('CumulativeStats', () => {
    it('should have required properties only', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 500,
      };

      // Assert
      expect(stats.hits).toBe(200);
      expect(stats.total).toBe(500);
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.itemCount).toBeUndefined();
    });

    it('should allow all optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 500,
        disposedItems: 10,
        itemCount: 50,
        length: 2000,
        max: 100,
      };

      // Assert
      expect(stats.disposedItems).toBe(10);
      expect(stats.itemCount).toBe(50);
      expect(stats.length).toBe(2000);
      expect(stats.max).toBe(100);
    });

    it('should allow partial optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 100,
        total: 150,
        disposedItems: 5,
        max: 75,
      };

      // Assert
      expect(stats.disposedItems).toBe(5);
      expect(stats.max).toBe(75);
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
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

    it('should support undefined hitRate', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'cache',
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support hitRate of 0 (0%)', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 100,
        name: 'missed-cache',
      };

      // Assert
      expect(stats.hitRate).toBe(0);
    });

    it('should support hitRate of 1 (100%)', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 1,
        hits: 100,
        total: 100,
        name: 'perfect-cache',
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });

    it('should support empty name', () => {
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

  describe('LRUDiskCacheOptions', () => {
    it('should allow empty options object', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should allow max option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 1000,
      };

      // Assert
      expect(options.max).toBe(1000);
    });

    it('should allow maxAge option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 5000,
      };

      // Assert
      expect(options.maxAge).toBe(5000);
    });

    it('should allow stale option set to true', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: true,
      };

      // Assert
      expect(options.stale).toBe(true);
    });

    it('should allow stale option set to false', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        stale: false,
      };

      // Assert
      expect(options.stale).toBe(false);
    });

    it('should allow all options together', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 2000,
        maxAge: 10000,
        stale: true,
      };

      // Assert
      expect(options.max).toBe(2000);
      expect(options.maxAge).toBe(10000);
      expect(options.stale).toBe(true);
    });

    it('should support max of 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 0,
      };

      // Assert
      expect(options.max).toBe(0);
    });

    it('should support maxAge of 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 0,
      };

      // Assert
      expect(options.maxAge).toBe(0);
    });

    it('should support Infinity as max', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Infinity,
      };

      // Assert
      expect(options.max).toBe(Infinity);
    });

    it('should support large maxAge values', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 86400000, // 24 hours in ms
      };

      // Assert
      expect(options.maxAge).toBe(86400000);
    });
  });

  describe('Type compatibility and edge cases', () => {
    it('should allow FetchResult with union type', () => {
      // Arrange & Act
      const result: FetchResult<string | number> = {
        value: 'test',
        maxAge: 1000,
      };

      // Assert
      expect(typeof result.value).toBe('string');
    });

    it('should allow DiskStats with large numbers', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: Number.MAX_SAFE_INTEGER,
        total: Number.MAX_SAFE_INTEGER,
        name: 'large-cache',
      };

      // Assert
      expect(stats.hits).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should allow CumulativeStats with mixed defined/undefined properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 100,
        total: 200,
        disposedItems: undefined,
        itemCount: 50,
        length: undefined,
        max: 150,
      };

      // Assert
      expect(stats.hits).toBe(100);
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.itemCount).toBe(50);
    });
  });
});
