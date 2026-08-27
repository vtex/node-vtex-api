import { AttributeKeys } from '../../constants'

const normalizeAttribute = (value?: string): string | undefined => {
  const normalized = value?.trim()
  return normalized || undefined
}

export const getClusterResourceAttributes = (
  clusterId?: string,
  clusterRole?: string
): Record<string, string> => {
  const attributes: Record<string, string> = {}
  const normalizedClusterId = normalizeAttribute(clusterId)
  const normalizedClusterRole = normalizeAttribute(clusterRole)

  if (normalizedClusterId) {
    attributes[AttributeKeys.VTEX_IO_CLUSTER_ID] = normalizedClusterId
  }

  if (normalizedClusterRole) {
    attributes[AttributeKeys.VTEX_IO_CLUSTER_ROLE] = normalizedClusterRole
  }

  return attributes
}
