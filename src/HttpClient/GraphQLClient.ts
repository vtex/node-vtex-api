import { GraphQLError } from 'graphql'

import { HttpClient } from './HttpClient'
import { RequestConfig } from './typings'

interface QueryOptions<Variables extends object> {
  query: string
  variables: Variables
  useGet?: boolean
}

interface MutateOptions<Variables extends object> {
  mutate: string
  variables: Variables
}

export type Serializable = object | boolean | string | number

export interface GraphQLResponse <T extends Serializable> {
  data?: T
  errors?: GraphQLError[]
  extensions?: Record<string, any>
}

export class GraphQLClient {
  constructor(
    private http: HttpClient
  ) {}

  public query = <Data extends Serializable, Variables extends object>(
    { query, variables, useGet }: QueryOptions<Variables>,
    config: RequestConfig = {}
  ) => useGet
    ? this.http.get<GraphQLResponse<Data>>(config.url || '', {
      ...config,
      params: {
        query,
        variables: JSON.stringify(variables),
      },
    })
    : this.http.post<GraphQLResponse<Data>>(config.url || '',
      { query, variables },
      config
    )

  public mutate = <Data extends Serializable, Variables extends object>(
    { mutate, variables }: MutateOptions<Variables>,
    config: RequestConfig = {}
  ) =>
    this.http.post<GraphQLResponse<Data>>(
      config.url || '',
      { query: mutate, variables },
      config
    )
}
