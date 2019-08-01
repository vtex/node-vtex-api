import { GraphQLError } from 'graphql'

import CustomGraphQLError from '../errors/customGraphQLError'
import { HttpClient } from './HttpClient'
import { inflightUrlWithQuery } from './middlewares/inflight'
import { RequestConfig } from './typings'

interface QueryOptions<Variables extends object> {
  query: string
  variables: Variables
  inflight?: boolean
  throwOnError?: boolean
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

export class GraphQLClient {
  constructor(
    private http: HttpClient
  ) {}

  public query = <Data extends Serializable, Variables extends object>(
    { query, variables, inflight, throwOnError }: QueryOptions<Variables>,
    config: RequestConfig = {}
  ): Promise<GraphQLResponse<Data>> => this.http.getWithBody<GraphQLResponse<Data>>(
    config.url || '',
    { query, variables },
    {
      inflightKey: inflight !== false ? inflightUrlWithQuery : undefined,
      ...config,
    })
    .then(graphqlResponse => throwOnError === false
      ? graphqlResponse
      : throwOnGraphQLErrors(this.http.name, graphqlResponse)
    )

  public mutate = <Data extends Serializable, Variables extends object>(
    { mutate, variables, throwOnError }: MutateOptions<Variables>,
    config: RequestConfig = {}
  ) =>
    this.http.post<GraphQLResponse<Data>>(
      config.url || '',
      { query: mutate, variables },
      config
    )
    .then(graphqlResponse => throwOnError === false
      ? graphqlResponse
      : throwOnGraphQLErrors(this.http.name, graphqlResponse)
    )
}
