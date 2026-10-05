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
    it('should allow creating a FetchResult with required value field', () => {
      // Arrange & Act
      const result: FetchResult<string> = { value: 'test' };

      // Assert
      expect(result.value).toBe('test');
      expect(result.maxAge).toBeUndefined();
    });

    it('should allow creating a FetchResult with optional maxAge', () => {
      // Arrange & Act
      const result: FetchResult<number> = { value: 42, maxAge: 5000 };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBe(5000);
    });

    it('should support different value types', () => {
      // Arrange & Act
      const objResult: FetchResult<{ key: string }> = {
        value: { key: 'data' },
        maxAge: 1000,
      };

      // Assert
      expect(objResult.value.key).toBe('data');
      expect(objResult.maxAge).toBe(1000);
    });

    it('should support array types', () => {
      // Arrange & Act
      const arrayResult: FetchResult<number[]> = {
        value: [1, 2, 3],
        maxAge: 2000,
      };

      // Assert
      expect(arrayResult.value).toEqual([1, 2, 3]);
      expect(arrayResult.maxAge).toBe(2000);
    });

    it('should support null as value', () => {
      // Arrange & Act
      const result: FetchResult<string | null> = { value: null };

      // Assert
      expect(result.value).toBeNull();
    });

    it('should support zero as maxAge', () => {
      // Arrange & Act
      const result: FetchResult<string> = { value: 'test', maxAge: 0 };

      // Assert
      expect(result.maxAge).toBe(0);
    });
  });

  describe('DiskStats', () => {
    it('should create DiskStats with all required fields', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 10,
        total: 100,
        name: 'cache-disk',
      };

      // Assert
      expect(stats.hits).toBe(10);
      expect(stats.total).toBe(100);
      expect(stats.name).toBe('cache-disk');
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

    it('should support empty string name', () => {
      // Arrange & Act
      const stats: DiskStats = {
        hits: 5,
        total: 50,
        name: '',
      };

      // Assert
      expect(stats.name).toBe('');
    });

    it('should support large numbers', () => {
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
        itemCount: 5,
        length: 100,
        disposedItems: 2,
        hitRate: 0.5,
        hits: 50,
        max: 1000,
        name: 'lru-cache',
        total: 100,
      };

      // Assert
      expect(stats.itemCount).toBe(5);
      expect(stats.length).toBe(100);
      expect(stats.disposedItems).toBe(2);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.hits).toBe(50);
      expect(stats.max).toBe(1000);
      expect(stats.name).toBe('lru-cache');
      expect(stats.total).toBe(100);
    });

    it('should support undefined hitRate', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 3,
        length: 50,
        disposedItems: 0,
        hitRate: undefined,
        hits: 0,
        max: 500,
        name: 'lru-no-hits',
        total: 0,
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
        name: 'empty',
        total: 0,
      };

      // Assert
      expect(stats.itemCount).toBe(0);
      expect(stats.length).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should support hitRate of 1', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 10,
        length: 100,
        disposedItems: 0,
        hitRate: 1,
        hits: 100,
        max: 1000,
        name: 'perfect-hit',
        total: 100,
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });
  });

  describe('CumulativeStats', () => {
    it('should create CumulativeStats with required fields only', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 100,
        total: 500,
      };

      // Assert
      expect(stats.hits).toBe(100);
      expect(stats.total).toBe(500);
      expect(stats.disposedItems).toBeUndefined();
      expect(stats.itemCount).toBeUndefined();
    });

    it('should support all optional fields', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 200,
        total: 1000,
        disposedItems: 50,
        itemCount: 20,
        length: 500,
        max: 5000,
      };

      // Assert
      expect(stats.disposedItems).toBe(50);
      expect(stats.itemCount).toBe(20);
      expect(stats.length).toBe(500);
      expect(stats.max).toBe(5000);
    });

    it('should support partial optional fields', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 150,
        total: 750,
        disposedItems: 30,
        max: 3000,
      };

      // Assert
      expect(stats.disposedItems).toBe(30);
      expect(stats.max).toBe(3000);
      expect(stats.itemCount).toBeUndefined();
      expect(stats.length).toBeUndefined();
    });

    it('should support zero values for optional fields', () => {
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

  describe('MultilayerStats', () => {
    it('should create MultilayerStats with all required fields', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.75,
        hits: 75,
        total: 100,
        name: 'multilayer-cache',
      };

      // Assert
      expect(stats.hitRate).toBe(0.75);
      expect(stats.hits).toBe(75);
      expect(stats.total).toBe(100);
      expect(stats.name).toBe('multilayer-cache');
    });

    it('should support undefined hitRate', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 100,
        name: 'multilayer-no-hits',
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
        name: 'empty-multilayer',
      };

      // Assert
      expect(stats.hitRate).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should support hitRate of 1 (perfect hit rate)', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 1,
        hits: 500,
        total: 500,
        name: 'perfect-multilayer',
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });

    it('should support decimal hitRate values', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: 0.333,
        hits: 33,
        total: 99,
        name: 'decimal-rate',
      };

      // Assert
      expect(stats.hitRate).toBe(0.333);
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

    it('should support max option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: 1000 };

      // Assert
      expect(options.max).toBe(1000);
    });

    it('should support maxAge option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { maxAge: 60000 };

      // Assert
      expect(options.maxAge).toBe(60000);
    });

    it('should support stale option true', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { stale: true };

      // Assert
      expect(options.stale).toBe(true);
    });

    it('should support stale option false', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { stale: false };

      // Assert
      expect(options.stale).toBe(false);
    });

    it('should support all options together', () => {
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

    it('should support max of Infinity', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: Infinity };

      // Assert
      expect(options.max).toBe(Infinity);
    });

    it('should support zero max', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: 0 };

      // Assert
      expect(options.max).toBe(0);
    });

    it('should support zero maxAge', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { maxAge: 0 };

      // Assert
      expect(options.maxAge).toBe(0);
    });

    it('should support large maxAge values', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { maxAge: Number.MAX_SAFE_INTEGER };

      // Assert
      expect(options.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should support max and stale together', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: 2000, stale: true };

      // Assert
      expect(options.max).toBe(2000);
      expect(options.stale).toBe(true);
      expect(options.maxAge).toBeUndefined();
    });

    it('should support maxAge and stale together', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { maxAge: 10000, stale: true };

      // Assert
      expect(options.maxAge).toBe(10000);
      expect(options.stale).toBe(true);
      expect(options.max).toBeUndefined();
    });
  });
});
