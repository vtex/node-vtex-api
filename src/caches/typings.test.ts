import {
  FetchResult,
  DiskStats,
  LRUStats,
  CumulativeStats,
  MultilayerStats,
  LRUDiskCacheOptions,
} from './typings';

describe('typings', () => {
  describe('FetchResult', () => {
    it('should allow creating a FetchResult with value and maxAge', () => {
      // Arrange
      const fetchResult: FetchResult<string> = {
        value: 'test-value',
        maxAge: 5000,
      };

      // Act & Assert
      expect(fetchResult.value).toBe('test-value');
      expect(fetchResult.maxAge).toBe(5000);
    });

    it('should allow creating a FetchResult with value only', () => {
      // Arrange
      const fetchResult: FetchResult<number> = {
        value: 42,
      };

      // Act & Assert
      expect(fetchResult.value).toBe(42);
      expect(fetchResult.maxAge).toBeUndefined();
    });

    it('should support generic types with different value types', () => {
      // Arrange & Act
      const stringResult: FetchResult<string> = { value: 'hello' };
      const numberResult: FetchResult<number> = { value: 123 };
      const objectResult: FetchResult<{ id: number }> = { value: { id: 1 } };
      const arrayResult: FetchResult<string[]> = { value: ['a', 'b'] };

      // Assert
      expect(stringResult.value).toBe('hello');
      expect(numberResult.value).toBe(123);
      expect(objectResult.value).toEqual({ id: 1 });
      expect(arrayResult.value).toEqual(['a', 'b']);
    });

    it('should allow maxAge of 0', () => {
      // Arrange
      const fetchResult: FetchResult<string> = {
        value: 'test',
        maxAge: 0,
      };

      // Act & Assert
      expect(fetchResult.maxAge).toBe(0);
    });
  });

  describe('DiskStats', () => {
    it('should create DiskStats with all required properties', () => {
      // Arrange
      const stats: DiskStats = {
        hits: 10,
        total: 20,
        name: 'disk-cache',
      };

      // Act & Assert
      expect(stats.hits).toBe(10);
      expect(stats.total).toBe(20);
      expect(stats.name).toBe('disk-cache');
    });

    it('should support zero hits and total', () => {
      // Arrange
      const stats: DiskStats = {
        hits: 0,
        total: 0,
        name: 'empty-cache',
      };

      // Act & Assert
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should support large numbers for hits and total', () => {
      // Arrange
      const stats: DiskStats = {
        hits: 1000000,
        total: 5000000,
        name: 'large-cache',
      };

      // Act & Assert
      expect(stats.hits).toBe(1000000);
      expect(stats.total).toBe(5000000);
    });

    it('should support empty string name', () => {
      // Arrange
      const stats: DiskStats = {
        hits: 5,
        total: 10,
        name: '',
      };

      // Act & Assert
      expect(stats.name).toBe('');
    });
  });

  describe('LRUStats', () => {
    it('should create LRUStats with all required properties', () => {
      // Arrange
      const stats: LRUStats = {
        itemCount: 5,
        length: 100,
        disposedItems: 2,
        hitRate: 0.75,
        hits: 15,
        max: 50,
        name: 'lru-cache',
        total: 20,
      };

      // Act & Assert
      expect(stats.itemCount).toBe(5);
      expect(stats.length).toBe(100);
      expect(stats.disposedItems).toBe(2);
      expect(stats.hitRate).toBe(0.75);
      expect(stats.hits).toBe(15);
      expect(stats.max).toBe(50);
      expect(stats.name).toBe('lru-cache');
      expect(stats.total).toBe(20);
    });

    it('should allow hitRate to be undefined', () => {
      // Arrange
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

      // Act & Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support hitRate of 0 and 1', () => {
      // Arrange
      const statsNoHits: LRUStats = {
        itemCount: 5,
        length: 100,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 50,
        name: 'no-hits',
        total: 10,
      };

      const statsAllHits: LRUStats = {
        itemCount: 5,
        length: 100,
        disposedItems: 0,
        hitRate: 1,
        hits: 10,
        max: 50,
        name: 'all-hits',
        total: 10,
      };

      // Act & Assert
      expect(statsNoHits.hitRate).toBe(0);
      expect(statsAllHits.hitRate).toBe(1);
    });

    it('should support zero values for counts', () => {
      // Arrange
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 0,
        name: 'zero-stats',
        total: 0,
      };

      // Act & Assert
      expect(stats.itemCount).toBe(0);
      expect(stats.disposedItems).toBe(0);
      expect(stats.hits).toBe(0);
    });
  });

  describe('CumulativeStats', () => {
    it('should create CumulativeStats with required properties', () => {
      // Arrange
      const stats: CumulativeStats = {
        hits: 25,
        total: 50,
      };

      // Act & Assert
      expect(stats.hits).toBe(25);
      expect(stats.total).toBe(50);
    });

    it('should support all optional properties', () => {
      // Arrange
      const stats: CumulativeStats = {
        hits: 25,
        total: 50,
        disposedItems: 5,
        itemCount: 10,
        length: 200,
        max: 100,
      };

      // Act & Assert
      expect(stats.disposedItems).toBe(5);
      expect(stats.itemCount).toBe(10);
      expect(stats.length).toBe(200);
      expect(stats.max).toBe(100);
    });

    it('should allow any combination of optional properties', () => {
      // Arrange & Act
      const statsWithSome: CumulativeStats = {
        hits: 10,
        total: 20,
        disposedItems: 2,
      };

      const statsWithOthers: CumulativeStats = {
        hits: 10,
        total: 20,
        itemCount: 5,
        max: 50,
      };

      // Assert
      expect(statsWithSome.disposedItems).toBe(2);
      expect(statsWithSome.itemCount).toBeUndefined();
      expect(statsWithOthers.itemCount).toBe(5);
      expect(statsWithOthers.disposedItems).toBeUndefined();
    });

    it('should support zero values for required properties', () => {
      // Arrange
      const stats: CumulativeStats = {
        hits: 0,
        total: 0,
        disposedItems: 0,
        itemCount: 0,
        length: 0,
        max: 0,
      };

      // Act & Assert
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.disposedItems).toBe(0);
    });
  });

  describe('MultilayerStats', () => {
    it('should create MultilayerStats with all properties', () => {
      // Arrange
      const stats: MultilayerStats = {
        hitRate: 0.85,
        hits: 50,
        total: 60,
        name: 'multilayer',
      };

      // Act & Assert
      expect(stats.hitRate).toBe(0.85);
      expect(stats.hits).toBe(50);
      expect(stats.total).toBe(60);
      expect(stats.name).toBe('multilayer');
    });

    it('should allow hitRate to be undefined', () => {
      // Arrange
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'undefined-hitrate',
      };

      // Act & Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should support hitRate boundary values', () => {
      // Arrange
      const statsZero: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 10,
        name: 'zero-rate',
      };

      const statsOne: MultilayerStats = {
        hitRate: 1,
        hits: 10,
        total: 10,
        name: 'perfect-rate',
      };

      // Act & Assert
      expect(statsZero.hitRate).toBe(0);
      expect(statsOne.hitRate).toBe(1);
    });

    it('should support zero hits and total', () => {
      // Arrange
      const stats: MultilayerStats = {
        hitRate: 0,
        hits: 0,
        total: 0,
        name: 'empty-multilayer',
      };

      // Act & Assert
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should support decimal hitRate values', () => {
      // Arrange
      const stats: MultilayerStats = {
        hitRate: 0.3333,
        hits: 1,
        total: 3,
        name: 'decimal-rate',
      };

      // Act & Assert
      expect(stats.hitRate).toBeCloseTo(0.3333, 4);
    });
  });

  describe('LRUDiskCacheOptions', () => {
    it('should create options with no properties', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should support max property', () => {
      // Arrange
      const options: LRUDiskCacheOptions = {
        max: 1000,
      };

      // Act & Assert
      expect(options.max).toBe(1000);
    });

    it('should support maxAge property', () => {
      // Arrange
      const options: LRUDiskCacheOptions = {
        maxAge: 60000,
      };

      // Act & Assert
      expect(options.maxAge).toBe(60000);
    });

    it('should support stale property', () => {
      // Arrange
      const optionsTrue: LRUDiskCacheOptions = {
        stale: true,
      };

      const optionsFalse: LRUDiskCacheOptions = {
        stale: false,
      };

      // Act & Assert
      expect(optionsTrue.stale).toBe(true);
      expect(optionsFalse.stale).toBe(false);
    });

    it('should support all properties together', () => {
      // Arrange
      const options: LRUDiskCacheOptions = {
        max: 5000,
        maxAge: 120000,
        stale: true,
      };

      // Act & Assert
      expect(options.max).toBe(5000);
      expect(options.maxAge).toBe(120000);
      expect(options.stale).toBe(true);
    });

    it('should support zero values for max and maxAge', () => {
      // Arrange
      const options: LRUDiskCacheOptions = {
        max: 0,
        maxAge: 0,
      };

      // Act & Assert
      expect(options.max).toBe(0);
      expect(options.maxAge).toBe(0);
    });

    it('should support large values for max and maxAge', () => {
      // Arrange
      const options: LRUDiskCacheOptions = {
        max: Number.MAX_SAFE_INTEGER,
        maxAge: Number.MAX_SAFE_INTEGER,
      };

      // Act & Assert
      expect(options.max).toBe(Number.MAX_SAFE_INTEGER);
      expect(options.maxAge).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should support Infinity for max', () => {
      // Arrange
      const options: LRUDiskCacheOptions = {
        max: Infinity,
      };

      // Act & Assert
      expect(options.max).toBe(Infinity);
    });

    it('should support various combinations of optional properties', () => {
      // Arrange & Act
      const optionsMaxStale: LRUDiskCacheOptions = {
        max: 1000,
        stale: true,
      };

      const optionsMaxAgeStale: LRUDiskCacheOptions = {
        maxAge: 5000,
        stale: false,
      };

      // Assert
      expect(optionsMaxStale.max).toBe(1000);
      expect(optionsMaxStale.stale).toBe(true);
      expect(optionsMaxStale.maxAge).toBeUndefined();
      expect(optionsMaxAgeStale.maxAge).toBe(5000);
      expect(optionsMaxAgeStale.stale).toBe(false);
      expect(optionsMaxAgeStale.max).toBeUndefined();
    });
  });
});
