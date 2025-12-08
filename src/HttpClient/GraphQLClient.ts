import { GraphQLError } from 'graphql'

import CustomGraphQLError from '../errors/customGraphQLError'
import { HttpClient } from './HttpClient'
import { inflightUrlWithQuery } from './middlewares/inflight'
import { RequestConfig } from './typings'
import { extractGraphQLOperationInfoSync, GraphQLOperationInfo } from './utils/graphqlOperation'

interface QueryOptions<Variables extends object> {
  query: string
  variables: Variables
  inflight?: boolean
  throwOnError?: boolean
  extensions?: Record<string, any>
}

interface MutateOptions<Variables extends object> {
  mutate: string
  variables: Variables
  throwOnError?: boolean
}

export type Serializable = object | boolean | string | number

export interface GraphQLResponse <T extends Serializable> {
  data?: T
  errors?: GraphQLError[]
  extensions?: Record<string, any>
}

const throwOnGraphQLErrors = <T extends Serializable>(message: string, response: GraphQLResponse<T>) => {
  if (response && response.errors && response.errors.length > 0) {
    throw new CustomGraphQLError(message, response.errors)
  }
  return response
}

/**
 * Enriches the request config with GraphQL operation info for tracing and logging.
 * If the caller already provided a requestSpanNameSuffix, it takes precedence.
 */
const enrichConfigWithOperationInfo = (
  config: RequestConfig,
  operationInfo: GraphQLOperationInfo
): RequestConfig => {
  const { operationName, operationType } = operationInfo

  console.log('[GraphQL Debug] Extracted operation info:', { operationName, operationType })

  return {
    ...config,
    graphqlOperationName: operationName,
    graphqlOperationType: operationType,
    tracing: {
      ...config.tracing,
      // Only set requestSpanNameSuffix if not already provided by the caller
      requestSpanNameSuffix: config.tracing?.requestSpanNameSuffix ?? `${operationType}:${operationName}`,
    },
  }
}

export class GraphQLClient {
  constructor(
    private http: HttpClient
  ) {}

  public query = <Data extends Serializable, Variables extends object>(
    { query, variables, inflight, extensions, throwOnError }: QueryOptions<Variables>,
    config: RequestConfig = {}
  ): Promise<GraphQLResponse<Data>> => {
    const operationInfo = extractGraphQLOperationInfoSync(query)
    const enrichedConfig = enrichConfigWithOperationInfo(config, operationInfo)

    return this.http.getWithBody<GraphQLResponse<Data>>(
      enrichedConfig.url || '',
      { query, variables, extensions },
      {
        inflightKey: inflight !== false ? inflightUrlWithQuery : undefined,
        ...enrichedConfig,
      })
      .then(graphqlResponse => throwOnError === false
        ? graphqlResponse
        : throwOnGraphQLErrors(this.http.name, graphqlResponse)
      )
  }

  public mutate = <Data extends Serializable, Variables extends object>(
    { mutate, variables, throwOnError }: MutateOptions<Variables>,
    config: RequestConfig = {}
  ) => {
    const operationInfo = extractGraphQLOperationInfoSync(mutate)
    const enrichedConfig = enrichConfigWithOperationInfo(config, operationInfo)

    return this.http.post<GraphQLResponse<Data>>(
      enrichedConfig.url || '',
      { query: mutate, variables },
      enrichedConfig
    )
    .then(graphqlResponse => throwOnError === false
      ? graphqlResponse
      : throwOnGraphQLErrors(this.http.name, graphqlResponse)
    )
  }
}
