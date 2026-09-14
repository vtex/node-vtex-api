import {
  FetchResult,
  DiskStats,
  LRUStats,
  CumulativeStats,
  MultilayerStats,
  LRUDiskCacheOptions,
} from './typings';

describe('typings', () => {
  describe('FetchResult type', () => {
    it('should allow creating a FetchResult with only value property', () => {
      // Arrange & Act
      const result: FetchResult<string> = { value: 'test' };

      // Assert
      expect(result.value).toBe('test');
      expect(result.maxAge).toBeUndefined();
    });

    it('should allow creating a FetchResult with value and maxAge properties', () => {
      // Arrange & Act
      const result: FetchResult<number> = { value: 42, maxAge: 5000 };

      // Assert
      expect(result.value).toBe(42);
      expect(result.maxAge).toBe(5000);
    });

    it('should support generic type parameter for various value types', () => {
      // Arrange & Act
      const stringResult: FetchResult<string> = { value: 'hello' };
      const numberResult: FetchResult<number> = { value: 123 };
      const objectResult: FetchResult<{ key: string }> = {
        value: { key: 'value' },
      };
      const arrayResult: FetchResult<number[]> = { value: [1, 2, 3] };

      // Assert
      expect(stringResult.value).toBe('hello');
      expect(numberResult.value).toBe(123);
      expect(objectResult.value).toEqual({ key: 'value' });
      expect(arrayResult.value).toEqual([1, 2, 3]);
    });

    it('should allow maxAge to be zero', () => {
      // Arrange & Act
      const result: FetchResult<string> = { value: 'test', maxAge: 0 };

      // Assert
      expect(result.maxAge).toBe(0);
    });
  });

  describe('DiskStats type', () => {
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

    it('should allow empty string for name', () => {
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

  describe('LRUStats type', () => {
    it('should create LRUStats with all required properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 5,
        length: 1024,
        disposedItems: 3,
        hitRate: 0.75,
        hits: 75,
        max: 100,
        name: 'lru-cache',
        total: 100,
      };

      // Assert
      expect(stats.itemCount).toBe(5);
      expect(stats.length).toBe(1024);
      expect(stats.disposedItems).toBe(3);
      expect(stats.hitRate).toBe(0.75);
      expect(stats.hits).toBe(75);
      expect(stats.max).toBe(100);
      expect(stats.name).toBe('lru-cache');
      expect(stats.total).toBe(100);
    });

    it('should allow undefined hitRate', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: undefined,
        hits: 0,
        max: 1000,
        name: 'lru-cache',
        total: 0,
      };

      // Assert
      expect(stats.hitRate).toBeUndefined();
    });

    it('should allow zero values for all numeric properties', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 0,
        length: 0,
        disposedItems: 0,
        hitRate: 0,
        hits: 0,
        max: 0,
        name: 'zero-cache',
        total: 0,
      };

      // Assert
      expect(stats.itemCount).toBe(0);
      expect(stats.length).toBe(0);
      expect(stats.disposedItems).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should allow hitRate of 1 representing 100% hit rate', () => {
      // Arrange & Act
      const stats: LRUStats = {
        itemCount: 10,
        length: 2048,
        disposedItems: 0,
        hitRate: 1,
        hits: 100,
        max: 100,
        name: 'perfect-cache',
        total: 100,
      };

      // Assert
      expect(stats.hitRate).toBe(1);
    });
  });

  describe('CumulativeStats type', () => {
    it('should create CumulativeStats with required properties only', () => {
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

    it('should create CumulativeStats with all optional properties', () => {
      // Arrange & Act
      const stats: CumulativeStats = {
        hits: 50,
        total: 100,
        disposedItems: 5,
        itemCount: 10,
        length: 512,
        max: 1000,
      };

      // Assert
      expect(stats.disposedItems).toBe(5);
      expect(stats.itemCount).toBe(10);
      expect(stats.length).toBe(512);
      expect(stats.max).toBe(1000);
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

    it('should allow partial optional properties', () => {
      // Arrange & Act
      const statsWithSome: CumulativeStats = {
        hits: 25,
        total: 50,
        disposedItems: 3,
        itemCount: 7,
      };

      // Assert
      expect(statsWithSome.disposedItems).toBe(3);
      expect(statsWithSome.itemCount).toBe(7);
      expect(statsWithSome.length).toBeUndefined();
      expect(statsWithSome.max).toBeUndefined();
    });
  });

  describe('MultilayerStats type', () => {
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

    it('should allow undefined hitRate', () => {
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

    it('should allow zero values for hits and total', () => {
      // Arrange & Act
      const stats: MultilayerStats = {
        hitRate: undefined,
        hits: 0,
        total: 0,
        name: 'no-access',
      };

      // Assert
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should allow hitRate of 1 representing perfect hit rate', () => {
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
  });

  describe('LRUDiskCacheOptions type', () => {
    it('should create empty LRUDiskCacheOptions object', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = {};

      // Assert
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should create LRUDiskCacheOptions with max option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: 1000 };

      // Assert
      expect(options.max).toBe(1000);
      expect(options.maxAge).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should create LRUDiskCacheOptions with maxAge option', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { maxAge: 60000 };

      // Assert
      expect(options.maxAge).toBe(60000);
      expect(options.max).toBeUndefined();
      expect(options.stale).toBeUndefined();
    });

    it('should create LRUDiskCacheOptions with stale option true', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { stale: true };

      // Assert
      expect(options.stale).toBe(true);
      expect(options.max).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
    });

    it('should create LRUDiskCacheOptions with stale option false', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { stale: false };

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

    it('should allow max option with zero value', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: 0 };

      // Assert
      expect(options.max).toBe(0);
    });

    it('should allow maxAge option with zero value', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { maxAge: 0 };

      // Assert
      expect(options.maxAge).toBe(0);
    });

    it('should allow max option with very large values', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: Number.MAX_SAFE_INTEGER };

      // Assert
      expect(options.max).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should allow partial combination of options', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: 2000, stale: true };

      // Assert
      expect(options.max).toBe(2000);
      expect(options.stale).toBe(true);
      expect(options.maxAge).toBeUndefined();
    });
  });

  describe('Type compatibility and structure', () => {
    it('should allow assignment of FetchResult to a variable', () => {
      // Arrange & Act
      const result: FetchResult<string> = { value: 'data', maxAge: 1000 };
      const stored = result;

      // Assert
      expect(stored.value).toBe('data');
      expect(stored.maxAge).toBe(1000);
    });

    it('should allow array of FetchResults', () => {
      // Arrange & Act
      const results: FetchResult<number>[] = [
        { value: 1 },
        { value: 2, maxAge: 500 },
        { value: 3, maxAge: 1000 },
      ];

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].value).toBe(1);
      expect(results[1].maxAge).toBe(500);
    });

    it('should allow nested objects in FetchResult generic', () => {
      // Arrange & Act
      type NestedData = {
        id: number;
        name: string;
        metadata: { [key: string]: string };
      };
      const result: FetchResult<NestedData> = {
        value: {
          id: 1,
          name: 'test',
          metadata: { key: 'value' },
        },
      };

      // Assert
      expect(result.value.id).toBe(1);
      expect(result.value.name).toBe('test');
      expect(result.value.metadata.key).toBe('value');
    });
  });
});
