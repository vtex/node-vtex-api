import { DiagnosticsAttributeKeys } from '../../constants'
import { getClusterResourceAttributes } from './resourceAttributes'

describe('getClusterResourceAttributes', () => {
  it('maps both cluster values to reserved resource attributes', () => {
    expect(getClusterResourceAttributes('cluster-a', 'primary')).toEqual({
      [DiagnosticsAttributeKeys.CLUSTER_ID]: 'cluster-a',
      [DiagnosticsAttributeKeys.CLUSTER_ROLE]: 'primary',
    })
  })

  it('includes only the cluster identifier when role is missing', () => {
    expect(getClusterResourceAttributes('cluster-a', undefined)).toEqual({
      [DiagnosticsAttributeKeys.CLUSTER_ID]: 'cluster-a',
    })
  })

  it('includes only the cluster role when identifier is missing', () => {
    expect(getClusterResourceAttributes(undefined, 'primary')).toEqual({
      [DiagnosticsAttributeKeys.CLUSTER_ROLE]: 'primary',
    })
  })

  it('omits missing and empty values', () => {
    expect(getClusterResourceAttributes('', undefined)).toEqual({})
  })

  it('trims values and omits whitespace-only values independently', () => {
    expect(getClusterResourceAttributes('  cluster-a  ', '   ')).toEqual({
      [DiagnosticsAttributeKeys.CLUSTER_ID]: 'cluster-a',
    })
    expect(getClusterResourceAttributes('   ', '  primary  ')).toEqual({
      [DiagnosticsAttributeKeys.CLUSTER_ROLE]: 'primary',
    })
  })
})
