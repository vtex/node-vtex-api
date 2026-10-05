/**
 * Unit tests for src/caches/typings.ts
 * 
 * This file contains type definitions and interfaces for cache implementations.
 * Since these are TypeScript types/interfaces with no runtime behavior,
 * we test their structural integrity, assignability, and documentation.
 */

import {
  FetchResult,
  DiskStats,
  LRUStats,
  CumulativeStats,
  MultilayerStats,
  LRUDiskCacheOptions,
} from './typings';

describe('typings.ts', () => {
  describe('FetchResult type', () => {
    it('should accept a value with required value property', () => {
      // Arrange & Act
      const result: FetchResult<string> = {
        value: 'test-value',
      };

      // Assert
      expect(result.value).toBe('test-value');
      expect(result.maxAge).toBeUndefined();
    });

    it('should accept a value with optional maxAge property', () => {
      // Arrange & Act
      const result: FetchResult<number> = {
        value: 42,
        maxAge: 5000,
      };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBe(5000);
    });

    it('should accept maxAge as 0', () => {
      // Arrange & Act
      const result: FetchResult<boolean> = {
        value: true,
        maxAge: 0,
      };

      // Assert
      expect(result.maxAge).toBe(0);
    });

    it('should work with generic types (object)', () => {
      // Arrange
      const testObj = { id: 1, name: 'test' };

      // Act
      const result: FetchResult<typeof testObj> = {
        value: testObj,
        maxAge: 3000,
      };

      // Assert
      expect(result.value).toEqual(testObj);
    });

    it('should work with generic types (array)', () => {
      // Arrange
      const testArray = [1, 2, 3];

      // Act
      const result: FetchResult<number[]> = {
        value: testArray,
      };

      // Assert
      expect(result.value).toEqual(testArray);
    });
  });

  describe('DiskStats type', () => {
    it('should accept all required properties', () => {
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

    it('should accept zero values', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 0,
        total: 0,
        name: '',
      };

      // Assert
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.name).toBe('');
    });

    it('should accept large numbers', () => {
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

  describe('LRUStats type', () => {
    it('should accept all required properties with hitRate defined', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 50,
        length: 1024,
        disposedItems: 10,
        hitRate: 0.85,
        hits: 170,
        max: 200,
        name: 'lru-cache',
        total: 200,
      };

      // Assert
      expect(stats.itemCount).toBe(50);
      expect(stats.length).toBe(1024);
      expect(stats.disposedItems).toBe(10);
      expect(stats.hitRate).toBe(0.85);
      expect(stats.hits).toBe(170);
      expect(stats.max).toBe(200);
      expect(stats.name).toBe('lru-cache');
      expect(stats.total).toBe(200);
    });

    it('should accept undefined hitRate', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 25,
        length: 512,
        disposedItems: 5,
        hitRate: undefined,
        hits: 50,
        max: 100,
        name: 'lru-cache-2',
        total: 100,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should accept hitRate of 0', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 100,
        name: 'empty-lru',
        total: 0,
      };

      // Assert
      expect(stats.hitRate).toBe(0);
    });

    it('should accept hitRate of 1', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 10,
        length: 100,
        disposedItems: 0,
        hitRate: 1,
        hits: 100,
        max: 100,
        name: 'perfect-hit-rate',
        total: 100,
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });
  });

  describe('CumulativeStats type', () => {
    it('should accept required properties only', () => {
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

    it('should accept all properties including optional ones', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 500,
        total: 1000,
        disposedItems: 50,
        itemCount: 100,
        length: 2048,
        max: 200,
      };

      // Assert
      expect(stats.hits).toBe(500);
      expect(stats.total).toBe(1000);
      expect(stats.disposedItems).toBe(50);
      expect(stats.itemCount).toBe(100);
      expect(stats.length).toBe(2048);
      expect(stats.max).toBe(200);
    });

    it('should accept partial optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 100,
        total: 200,
        disposedItems: 10,
        max: 150,
      };

      // Assert
      expect(stats.disposedItems).toBe(10);
      expect(stats.max).toBe(150);
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
    });

    it('should accept zero values for optional properties', () => {
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
  });

  describe('MultilayerStats type', () => {
    it('should accept all required properties with hitRate defined', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.92,
        hits: 920,
        total: 1000,
        name: 'multilayer-cache',
      };

      // Assert
      expect(stats.hitRate).toBe(0.92);
      expect(stats.hits).toBe(920);
      expect(stats.total).toBe(1000);
      expect(stats.name).toBe('multilayer-cache');
    });

    it('should accept undefined hitRate', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 50,
        total: 100,
        name: 'undefined-hit-rate',
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should accept hitRate of 0', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 100,
        name: 'zero-hit-rate',
      };

      // Assert
      expect(stats.hitRate).toBe(0);
    });

    it('should accept hitRate of 1', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 1,
        hits: 100,
        total: 100,
        name: 'perfect-rate',
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });
  });

  describe('LRUDiskCacheOptions type', () => {
    it('should accept empty object (all properties optional)', () => {
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
        maxAge: 120000,
        stale: true,
      };

      // Assert
      expect(options.max).toBe(5000);
      expect(options.maxAge).toBe(120000);
      expect(options.stale).toBe(true);
    });

    it('should accept max as Infinity', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: Infinity,
      };

      // Assert
      expect(options.max).toBe(Infinity);
    });

    it('should accept max as 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        max: 0,
      };

      // Assert
      expect(options.max).toBe(0);
    });

    it('should accept maxAge as 0', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: 0,
      };

      // Assert
      expect(options.maxAge).toBe(0);
    });

    it('should accept large maxAge values', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {
        maxAge: Number.MAX_SAFE_INTEGER,
      };

      // Assert
      expect(options.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Type compatibility', () => {
    it('should allow assignment of compatible structures', () => {
      // Arrange
      const diskStats: DiskStats = {
        hits: 100,
        total: 200,
        name: 'test',
      };

      // Act & Assert
      expect(diskStats).toHaveProperty('hits');
      expect(diskStats).toHaveProperty('total');
      expect(diskStats).toHaveProperty('name');
    });

    it('should maintain type safety for FetchResult with different value types', () => {
      // Arrange
      const stringResult: FetchResult<string> = { value: 'test' };
      const numberResult: FetchResult<number> = { value: 123 };
      const objectResult: FetchResult<{ key: string }> = { value: { key: 'val' } };

      // Act & Assert
      expect(typeof stringResult.value).toBe('string');
      expect(typeof numberResult.value).toBe('number');
      expect(typeof objectResult.value).toBe('object');
    });
  });
});
