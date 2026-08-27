import { AttributeKeys } from '../../constants'
import { getClusterResourceAttributes } from './resourceAttributes'

describe('getClusterResourceAttributes', () => {
  it('maps both cluster values to reserved resource attributes', () => {
    expect(getClusterResourceAttributes('cluster-a', 'stores')).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster-a',
      [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'stores',
    })
  })

  it('includes only the cluster identifier when role is missing', () => {
    expect(getClusterResourceAttributes('cluster-a', undefined)).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster-a',
    })
  })

  it('includes only the cluster role when identifier is missing', () => {
    expect(getClusterResourceAttributes(undefined, 'stores')).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'stores',
    })
  })

  it('omits missing and empty values', () => {
    expect(getClusterResourceAttributes('', undefined)).toEqual({})
  })

  it('trims values and omits whitespace-only values independently', () => {
    expect(getClusterResourceAttributes('  cluster-a  ', '   ')).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster-a',
    })
    expect(getClusterResourceAttributes('   ', '  stores  ')).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'stores',
    })
  })
})

import { AttributeKeys } from '../../constants'
import { getClusterResourceAttributes } from './resourceAttributes'

describe('getClusterResourceAttributes', () => {
  it('maps both cluster values to reserved resource attributes', () => {
    expect(getClusterResourceAttributes('cluster-a', 'stores')).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster-a',
      [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'stores',
    })
  })

  it('includes only the cluster identifier when role is missing', () => {
    expect(getClusterResourceAttributes('cluster-a', undefined)).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster-a',
    })
  })

  it('includes only the cluster role when identifier is missing', () => {
    expect(getClusterResourceAttributes(undefined, 'stores')).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'stores',
    })
  })

  it('omits missing and empty values', () => {
    expect(getClusterResourceAttributes('', undefined)).toEqual({})
  })

  it('trims values and omits whitespace-only values independently', () => {
    expect(getClusterResourceAttributes('  cluster-a  ', '   ')).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster-a',
    })
    expect(getClusterResourceAttributes('   ', '  stores  ')).toEqual({
      [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'stores',
    })
  })

  describe('normalizeAttribute edge cases', () => {
    it('returns empty object when both parameters are undefined', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes(undefined, undefined)

      // Assert
      expect(result).toEqual({})
    })

    it('returns empty object when both parameters are empty strings', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('', '')

      // Assert
      expect(result).toEqual({})
    })

    it('returns empty object when both parameters are whitespace only', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('  ', '\t\n')

      // Assert
      expect(result).toEqual({})
    })

    it('preserves internal whitespace after trimming', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('  cluster a b  ', '  role name  ')

      // Assert
      expect(result).toEqual({
        [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster a b',
        [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'role name',
      })
    })

    it('handles single space characters', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes(' ', ' ')

      // Assert
      expect(result).toEqual({})
    })

    it('handles tab and newline characters', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('\t\n', '\n\t')

      // Assert
      expect(result).toEqual({})
    })
  })

  describe('getClusterResourceAttributes return type validation', () => {
    it('always returns an object', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes()

      // Assert
      expect(typeof result).toBe('object')
      expect(result).not.toBeNull()
    })

    it('returns a record with string keys and string values', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('test-cluster', 'test-role')

      // Assert
      Object.entries(result).forEach(([key, value]) => {
        expect(typeof key).toBe('string')
        expect(typeof value).toBe('string')
      })
    })

    it('returns a new object on each call', () => {
      // Arrange & Act
      const result1 = getClusterResourceAttributes('cluster', 'role')
      const result2 = getClusterResourceAttributes('cluster', 'role')

      // Assert
      expect(result1).toEqual(result2)
      expect(result1).not.toBe(result2)
    })
  })

  describe('attribute key assignment', () => {
    it('assigns clusterId to VTEX_IO_CLUSTER_ID key', () => {
      // Arrange
      const clusterId = 'my-cluster'

      // Act
      const result = getClusterResourceAttributes(clusterId, undefined)

      // Assert
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ID]).toBe(clusterId)
    })

    it('assigns clusterRole to VTEX_IO_CLUSTER_ROLE key', () => {
      // Arrange
      const clusterRole = 'master'

      // Act
      const result = getClusterResourceAttributes(undefined, clusterRole)

      // Assert
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ROLE]).toBe(clusterRole)
    })

    it('does not include undefined attributes in object', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('cluster-only', undefined)

      // Assert
      expect(Object.keys(result).length).toBe(1)
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ROLE]).toBeUndefined()
    })
  })

  describe('special characters and edge values', () => {
    it('preserves special characters in values', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('cluster-1_test@v2', 'role/sub-role')

      // Assert
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ID]).toBe('cluster-1_test@v2')
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ROLE]).toBe('role/sub-role')
    })

    it('handles very long string values', () => {
      // Arrange
      const longClusterId = 'a'.repeat(1000)
      const longRole = 'b'.repeat(1000)

      // Act
      const result = getClusterResourceAttributes(longClusterId, longRole)

      // Assert
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ID]).toBe(longClusterId)
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ROLE]).toBe(longRole)
    })

    it('handles numeric strings', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('12345', '67890')

      // Assert
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ID]).toBe('12345')
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ROLE]).toBe('67890')
    })

    it('handles unicode characters', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('cluster-🚀', 'role-✨')

      // Assert
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ID]).toBe('cluster-🚀')
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ROLE]).toBe('role-✨')
    })
  })

  describe('parameter isolation', () => {
    it('does not include clusterId when only clusterRole is provided and valid', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes(undefined, 'stores')

      // Assert
      expect(Object.keys(result).length).toBe(1)
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ID]).toBeUndefined()
    })

    it('does not include clusterRole when only clusterId is provided and valid', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('cluster-1', undefined)

      // Assert
      expect(Object.keys(result).length).toBe(1)
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ROLE]).toBeUndefined()
    })
  })
})