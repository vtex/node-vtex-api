import { GraphQLError } from 'graphql'

import { HttpClient } from './HttpClient'
import { RequestConfig } from './typings'

interface QueryOptions<Variables extends object> extends RequestConfig {
  query: string
  variables: Variables
  useGet?: boolean
}

interface MutateOptions<Variables extends object> extends RequestConfig {
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

  public query = <Data extends Serializable, Variables extends object>({
    query,
    variables,
    useGet,
    url,
    ...opts
  }: QueryOptions<Variables>) => useGet
      ? this.http.get<GraphQLResponse<Data>>(url || '', {
        ...opts,
        params: {
          query,
          variables: JSON.stringify(variables),
        },
      })
      : this.http.post<GraphQLResponse<Data>>(url || '', {
        ...opts,
        query,
        variables,
      })

  public mutate = <Data extends Serializable, Variables extends object>({
    mutate,
    variables,
    url,
    ...opts
  }: MutateOptions<Variables>) =>
    this.http.post<GraphQLResponse<Data>>(url || '', {
      ...opts,
      query: mutate,
      variables,
    })
}
