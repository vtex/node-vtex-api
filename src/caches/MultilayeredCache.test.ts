import { MultilayeredCache } from './MultilayeredCache';
import { CacheLayer } from './CacheLayer';
import { WindowedCounters } from './WindowedCounters';

jest.mock('./WindowedCounters');

type TestKey = string;
type TestValue = string | number;

describe('MultilayeredCache', () => {
  let mockCaches: jest.Mocked<CacheLayer<TestKey, TestValue>>[];
  let mockCounters: jest.Mocked<WindowedCounters>;
  let cache: MultilayeredCache<TestKey, TestValue>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCounters = WindowedCounters as jest.MockedClass<typeof WindowedCounters>;
    mockCounters.prototype.countRead = jest.fn();
    mockCounters.prototype.countHit = jest.fn();
    mockCounters.prototype.windowed = jest.fn().mockReturnValue({
      hits: 5,
      total: 10,
    });
    mockCounters.prototype.cumulative = jest.fn().mockReturnValue({
      hits: 15,
      total: 30,
    });
  });

  describe('constructor', () => {
    it('should initialize with an array of cache layers', () => {
      // Arrange
      mockCaches = [
        createMockCache(),
        createMockCache(),
      ];

      // Act
      cache = new MultilayeredCache(mockCaches);

      // Assert
      expect(cache).toBeDefined();
    });

    it('should initialize with an empty array of cache layers', () => {
      // Arrange
      mockCaches = [];

      // Act
      cache = new MultilayeredCache(mockCaches);

      // Assert
      expect(cache).toBeDefined();
    });
  });

  describe('get', () => {
    beforeEach(() => {
      mockCaches = [
        createMockCache(),
        createMockCache(),
        createMockCache(),
      ];
      cache = new MultilayeredCache(mockCaches);
    });

    it('should return value from first cache layer that has the key', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      mockCaches[0].get.mockResolvedValue(value);
      mockCaches[0].has.mockResolvedValue(true);
      mockCaches[0].set.mockResolvedValue(true);

      // Act
      const result = await cache.get(key);

      // Assert
      expect(result).toBe(value);
      expect(mockCaches[0].get).toHaveBeenCalledWith(key);
      expect(mockCaches[0].has).toHaveBeenCalledWith(key);
    });

    it('should return value from second cache layer if first does not have key', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      mockCaches[0].get.mockResolvedValue(undefined);
      mockCaches[0].has.mockResolvedValue(false);
      mockCaches[1].get.mockResolvedValue(value);
      mockCaches[1].has.mockResolvedValue(true);
      mockCaches[0].set.mockResolvedValue(true);
      mockCaches[1].set.mockResolvedValue(true);

      // Act
      const result = await cache.get(key);

      // Assert
      expect(result).toBe(value);
      expect(mockCaches[0].set).toHaveBeenCalledWith(key, value, undefined);
    });

    it('should use fetcher when key is not found in any cache', async () => {
      // Arrange
      const key = 'test-key';
      const fetchedValue = 'fetched-value';
      const maxAge = 3600;
      mockCaches[0].has.mockResolvedValue(false);
      mockCaches[1].has.mockResolvedValue(false);
      mockCaches[2].has.mockResolvedValue(false);
      mockCaches.forEach(c => c.get.mockResolvedValue(undefined));
      mockCaches.forEach(c => c.set.mockResolvedValue(true));
      const fetcher = jest.fn().mockResolvedValue({
        value: fetchedValue,
        maxAge,
      });

      // Act
      const result = await cache.get(key, fetcher);

      // Assert
      expect(result).toBe(fetchedValue);
      expect(fetcher).toHaveBeenCalled();
      mockCaches.forEach(c => {
        expect(c.set).toHaveBeenCalledWith(key, fetchedValue, maxAge);
      });
    });

    it('should return undefined when key not found and no fetcher provided', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches[0].has.mockResolvedValue(false);
      mockCaches[1].has.mockResolvedValue(false);
      mockCaches[2].has.mockResolvedValue(false);
      mockCaches.forEach(c => c.get.mockResolvedValue(undefined));

      // Act
      const result = await cache.get(key);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should populate failed cache layers when value is found in later layer', async () => {
      // Arrange
      const key = 'test-key';
      const value = 123;
      mockCaches[0].has.mockResolvedValue(false);
      mockCaches[0].get.mockResolvedValue(undefined);
      mockCaches[1].has.mockResolvedValue(true);
      mockCaches[1].get.mockResolvedValue(value);
      mockCaches[0].set.mockResolvedValue(true);
      mockCaches[1].set.mockResolvedValue(true);
      mockCaches[2].set.mockResolvedValue(true);

      // Act
      await cache.get(key);

      // Assert
      expect(mockCaches[0].set).toHaveBeenCalledWith(key, value, undefined);
      expect(mockCaches[1].set).not.toHaveBeenCalled();
      expect(mockCaches[2].set).not.toHaveBeenCalled();
    });

    it('should populate all cache layers when value is fetched', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'fetched';
      mockCaches.forEach(c => {
        c.has.mockResolvedValue(false);
        c.get.mockResolvedValue(undefined);
        c.set.mockResolvedValue(true);
      });
      const fetcher = jest.fn().mockResolvedValue({
        value,
        maxAge: undefined,
      });

      // Act
      await cache.get(key, fetcher);

      // Assert
      mockCaches.forEach(c => {
        expect(c.set).toHaveBeenCalledWith(key, value, undefined);
      });
    });

    it('should handle undefined value from cache layer', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches[0].get.mockResolvedValue(undefined);
      mockCaches[0].has.mockResolvedValue(false);
      mockCaches[1].get.mockResolvedValue('actual-value');
      mockCaches[1].has.mockResolvedValue(true);
      mockCaches[0].set.mockResolvedValue(true);
      mockCaches[1].set.mockResolvedValue(true);

      // Act
      const result = await cache.get(key);

      // Assert
      expect(result).toBe('actual-value');
    });

    it('should count read on findIndex invocation', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches[0].has.mockResolvedValue(true);
      mockCaches[0].get.mockResolvedValue('value');
      mockCaches[0].set.mockResolvedValue(true);

      // Act
      await cache.get(key);

      // Assert
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      expect(instance.countRead).toHaveBeenCalled();
    });

    it('should count hit when key is found in first layer', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches[0].has.mockResolvedValue(true);
      mockCaches[0].get.mockResolvedValue('value');
      mockCaches[0].set.mockResolvedValue(true);

      // Act
      await cache.get(key);

      // Assert
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      expect(instance.countHit).toHaveBeenCalled();
    });

    it('should not count hit when key is not found', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches.forEach(c => {
        c.has.mockResolvedValue(false);
        c.get.mockResolvedValue(undefined);
      });

      // Act
      await cache.get(key);

      // Assert
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      expect(instance.countHit).not.toHaveBeenCalled();
    });
  });

  describe('set', () => {
    beforeEach(() => {
      mockCaches = [
        createMockCache(),
        createMockCache(),
        createMockCache(),
      ];
      cache = new MultilayeredCache(mockCaches);
    });

    it('should set value in all cache layers', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      mockCaches.forEach(c => c.set.mockResolvedValue(true));

      // Act
      const result = await cache.set(key, value);

      // Assert
      expect(result).toBe(true);
      mockCaches.forEach(c => {
        expect(c.set).toHaveBeenCalledWith(key, value, undefined);
      });
    });

    it('should set value with maxAge in all cache layers', async () => {
      // Arrange
      const key = 'test-key';
      const value = 123;
      const maxAge = 3600;
      mockCaches.forEach(c => c.set.mockResolvedValue(true));

      // Act
      const result = await cache.set(key, value, maxAge);

      // Assert
      expect(result).toBe(true);
      mockCaches.forEach(c => {
        expect(c.set).toHaveBeenCalledWith(key, value, maxAge);
      });
    });

    it('should return true if at least one cache layer succeeds', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      mockCaches[0].set.mockResolvedValue(false);
      mockCaches[1].set.mockResolvedValue(true);
      mockCaches[2].set.mockResolvedValue(false);

      // Act
      const result = await cache.set(key, value);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if all cache layers fail', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      mockCaches.forEach(c => c.set.mockResolvedValue(false));

      // Act
      const result = await cache.set(key, value);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle empty cache layers array', async () => {
      // Arrange
      cache = new MultilayeredCache([]);
      const key = 'test-key';
      const value = 'test-value';

      // Act
      const result = await cache.set(key, value);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle numeric value', async () => {
      // Arrange
      const key = 'numeric-key';
      const value = 42;
      mockCaches.forEach(c => c.set.mockResolvedValue(true));

      // Act
      await cache.set(key, value);

      // Assert
      mockCaches.forEach(c => {
        expect(c.set).toHaveBeenCalledWith(key, value, undefined);
      });
    });
  });

  describe('has', () => {
    beforeEach(() => {
      mockCaches = [
        createMockCache(),
        createMockCache(),
        createMockCache(),
      ];
      cache = new MultilayeredCache(mockCaches);
    });

    it('should return true if key exists in first layer', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches[0].has.mockResolvedValue(true);
      mockCaches[1].has.mockResolvedValue(false);
      mockCaches[2].has.mockResolvedValue(false);

      // Act
      const result = await cache.has(key);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true if key exists in any layer', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches[0].has.mockResolvedValue(false);
      mockCaches[1].has.mockResolvedValue(true);
      mockCaches[2].has.mockResolvedValue(false);

      // Act
      const result = await cache.has(key);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if key does not exist in any layer', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches.forEach(c => c.has.mockResolvedValue(false));

      // Act
      const result = await cache.has(key);

      // Assert
      expect(result).toBe(false);
    });

    it('should check all cache layers', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches.forEach(c => c.has.mockResolvedValue(false));

      // Act
      await cache.has(key);

      // Assert
      mockCaches.forEach(c => {
        expect(c.has).toHaveBeenCalledWith(key);
      });
    });

    it('should handle empty cache layers array', async () => {
      // Arrange
      cache = new MultilayeredCache([]);
      const key = 'test-key';

      // Act
      const result = await cache.has(key);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true if all layers have the key', async () => {
      // Arrange
      const key = 'test-key';
      mockCaches.forEach(c => c.has.mockResolvedValue(true));

      // Act
      const result = await cache.has(key);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      mockCaches = [createMockCache()];
      cache = new MultilayeredCache(mockCaches);
    });

    it('should return stats with default name', () => {
      // Arrange
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      (instance.windowed as jest.Mock).mockReturnValue({
        hits: 5,
        total: 10,
      });

      // Act
      const stats = cache.getStats();

      // Assert
      expect(stats).toEqual({
        hitRate: 0.5,
        hits: 5,
        name: 'multilayred-cache',
        total: 10,
      });
    });

    it('should return stats with custom name', () => {
      // Arrange
      const customName = 'custom-cache';
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      (instance.windowed as jest.Mock).mockReturnValue({
        hits: 5,
        total: 10,
      });

      // Act
      const stats = cache.getStats(customName);

      // Assert
      expect(stats).toEqual({
        hitRate: 0.5,
        hits: 5,
        name: customName,
        total: 10,
      });
    });

    it('should return undefined hitRate when total is zero', () => {
      // Arrange
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      (instance.windowed as jest.Mock).mockReturnValue({
        hits: 0,
        total: 0,
      });

      // Act
      const stats = cache.getStats();

      // Assert
      expect(stats.hitRate).toBeUndefined();
      expect(stats.hits).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should calculate hitRate correctly', () => {
      // Arrange
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      (instance.windowed as jest.Mock).mockReturnValue({
        hits: 3,
        total: 4,
      });

      // Act
      const stats = cache.getStats();

      // Assert
      expect(stats.hitRate).toBe(0.75);
    });

    it('should return hitRate of 0 when hits is zero and total is positive', () => {
      // Arrange
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      (instance.windowed as jest.Mock).mockReturnValue({
        hits: 0,
        total: 10,
      });

      // Act
      const stats = cache.getStats();

      // Assert
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      mockCaches = [createMockCache()];
      cache = new MultilayeredCache(mockCaches);
    });

    it('should return cumulative stats from counters', () => {
      // Arrange
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      (instance.cumulative as jest.Mock).mockReturnValue({
        hits: 15,
        total: 30,
      });

      // Act
      const stats = cache.getCumulativeStats();

      // Assert
      expect(stats).toEqual({
        hits: 15,
        total: 30,
      });
    });

    it('should return cumulative stats with zeros', () => {
      // Arrange
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];
      (instance.cumulative as jest.Mock).mockReturnValue({
        hits: 0,
        total: 0,
      });

      // Act
      const stats = cache.getCumulativeStats();

      // Assert
      expect(stats).toEqual({
        hits: 0,
        total: 0,
      });
    });

    it('should call counters.cumulative() method', () => {
      // Arrange
      const instance = (WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mock.instances[0];

      // Act
      cache.getCumulativeStats();

      // Assert
      expect(instance.cumulative).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      mockCaches = [
        createMockCache(),
        createMockCache(),
      ];
      cache = new MultilayeredCache(mockCaches);
    });

    it('should handle sequential get operations', async () => {
      // Arrange
      const key1 = 'key1';
      const value1 = 'value1';
      const key2 = 'key2';
      const value2 = 'value2';
      mockCaches[0].get.mockResolvedValueOnce(value1).mockResolvedValueOnce(undefined);
      mockCaches[0].has.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mockCaches[1].get.mockResolvedValue(value2);
      mockCaches[1].has.mockResolvedValue(true);
      mockCaches[0].set.mockResolvedValue(true);
      mockCaches[1].set.mockResolvedValue(true);

      // Act
      const result1 = await cache.get(key1);
      const result2 = await cache.get(key2);

      // Assert
      expect(result1).toBe(value1);
      expect(result2).toBe(value2);
      expect(mockCaches[0].set).toHaveBeenCalledWith(key2, value2, undefined);
    });

    it('should handle get with fetcher that returns maxAge', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'fetched-value';
      const maxAge = 7200;
      mockCaches.forEach(c => {
        c.has.mockResolvedValue(false);
        c.get.mockResolvedValue(undefined);
        c.set.mockResolvedValue(true);
      });
      const fetcher = jest.fn().mockResolvedValue({ value, maxAge });

      // Act
      const result = await cache.get(key, fetcher);

      // Assert
      expect(result).toBe(value);
      mockCaches.forEach(c => {
        expect(c.set).toHaveBeenCalledWith(key, value, maxAge);
      });
    });

    it('should handle get, set, and has operations in sequence', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      mockCaches[0].set.mockResolvedValue(true);
      mockCaches[1].set.mockResolvedValue(true);
      mockCaches[0].has.mockResolvedValue(true);
      mockCaches[1].has.mockResolvedValue(false);
      mockCaches[0].get.mockResolvedValue(value);

      // Act
      await cache.set(key, value);
      const hasKey = await cache.has(key);
      const retrievedValue = await cache.get(key);

      // Assert
      expect(hasKey).toBe(true);
      expect(retrievedValue).toBe(value);
    });
  });
});

function createMockCache<K, V>(): jest.Mocked<CacheLayer<K, V>> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn(),
  };
}
