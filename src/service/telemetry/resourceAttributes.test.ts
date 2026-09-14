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
