import { DocumentNode, OperationDefinitionNode, parse as gqlParse } from 'graphql'

import { LRUCache } from '../../caches/LRUCache'

export interface GraphQLOperationInfo {
  operationName: string
  operationType: 'query' | 'mutation' | 'subscription'
}

const UNKNOWN_OPERATION = 'unknown-operation'
const DEFAULT_OPERATION_INFO: GraphQLOperationInfo = {
  operationName: UNKNOWN_OPERATION,
  operationType: 'query',
}

/**
 * LRU cache for parsed GraphQL operation info.
 * Using the query string as key to avoid re-parsing the same query.
 */
const operationInfoCache = new LRUCache<string, GraphQLOperationInfo>({
  max: 500,
})

/**
 * Extracts operation name and type from a GraphQL query string.
 * Results are cached to avoid re-parsing the same query.
 *
 * @param query - The GraphQL query string
 * @returns The operation info with name and type
 */
export const extractGraphQLOperationInfo = async (query: string): Promise<GraphQLOperationInfo> => {
  const cached = await operationInfoCache.getOrSet(query, async () => ({
    value: parseGraphQLOperationInfo(query),
  }))

  return cached ?? DEFAULT_OPERATION_INFO
}

/**
 * Synchronous version of extractGraphQLOperationInfo.
 * Checks cache first, parses if not found.
 *
 * @param query - The GraphQL query string
 * @returns The operation info with name and type
 */
export const extractGraphQLOperationInfoSync = (query: string): GraphQLOperationInfo => {
  const cached = operationInfoCache.get(query)
  if (cached) {
    return cached
  }

  const info = parseGraphQLOperationInfo(query)
  // Set in cache (sync operation)
  operationInfoCache.set(query, info)
  return info
}

/**
 * Parses a GraphQL query string and extracts operation info.
 *
 * @param query - The GraphQL query string
 * @returns The operation info with name and type
 */
const parseGraphQLOperationInfo = (query: string): GraphQLOperationInfo => {
  try {
    const document: DocumentNode = gqlParse(query)

    const operationDefinition = document.definitions.find(
      (def): def is OperationDefinitionNode => def.kind === 'OperationDefinition'
    )

    if (!operationDefinition) {
      return DEFAULT_OPERATION_INFO
    }

    const operationType = operationDefinition.operation as GraphQLOperationInfo['operationType']
    const operationName = operationDefinition.name?.value ?? UNKNOWN_OPERATION

    return {
      operationName,
      operationType,
    }
  } catch {
    // If parsing fails, return default info
    return DEFAULT_OPERATION_INFO
  }
}
