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

describe('resourceAttributes', () => {
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

    it('returns empty object when both parameters are whitespace-only', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('   ', '\t\n')

      // Assert
      expect(result).toEqual({})
    })

    it('preserves internal whitespace after trimming', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('  cluster a b  ', '  role 1  ')

      // Assert
      expect(result).toEqual({
        [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster a b',
        [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'role 1',
      })
    })

    it('handles clusterId with only whitespace and clusterRole with value', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('  \t  ', 'production')

      // Assert
      expect(result).toEqual({
        [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'production',
      })
    })

    it('handles clusterRole with only whitespace and clusterId with value', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('cluster-xyz', '  \n  ')

      // Assert
      expect(result).toEqual({
        [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster-xyz',
      })
    })

    it('handles special characters in values', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('cluster-1.0@test', 'role_prod-staging')

      // Assert
      expect(result).toEqual({
        [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster-1.0@test',
        [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'role_prod-staging',
      })
    })

    it('handles numeric strings as values', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('12345', '9876')

      // Assert
      expect(result).toEqual({
        [AttributeKeys.VTEX_IO_CLUSTER_ID]: '12345',
        [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: '9876',
      })
    })

    it('returns a new object on each call', () => {
      // Arrange & Act
      const result1 = getClusterResourceAttributes('cluster-a', 'stores')
      const result2 = getClusterResourceAttributes('cluster-a', 'stores')

      // Assert
      expect(result1).toEqual(result2)
      expect(result1).not.toBe(result2)
    })

    it('does not mutate returned object by adding keys after return', () => {
      // Arrange
      const result = getClusterResourceAttributes('cluster-a', 'stores')
      const originalLength = Object.keys(result).length

      // Act
      result['newKey'] = 'newValue'

      // Assert - verify original function still returns correct object
      const freshResult = getClusterResourceAttributes('cluster-a', 'stores')
      expect(Object.keys(freshResult).length).toBe(originalLength)
      expect(freshResult).not.toHaveProperty('newKey')
    })

    it('handles very long string values', () => {
      // Arrange
      const longClusterId = 'a'.repeat(1000)
      const longClusterRole = 'b'.repeat(1000)

      // Act
      const result = getClusterResourceAttributes(longClusterId, longClusterRole)

      // Assert
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ID]).toBe(longClusterId)
      expect(result[AttributeKeys.VTEX_IO_CLUSTER_ROLE]).toBe(longClusterRole)
    })

    it('handles mixed leading and trailing whitespace', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes(' \t cluster-id \n ', ' \t role \n ')

      // Assert
      expect(result).toEqual({
        [AttributeKeys.VTEX_IO_CLUSTER_ID]: 'cluster-id',
        [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: 'role',
      })
    })

    it('handles zero as string value', () => {
      // Arrange & Act
      const result = getClusterResourceAttributes('0', '0')

      // Assert
      expect(result).toEqual({
        [AttributeKeys.VTEX_IO_CLUSTER_ID]: '0',
        [AttributeKeys.VTEX_IO_CLUSTER_ROLE]: '0',
      })
    })
  })
})