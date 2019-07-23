import { createHash } from 'crypto'
import { GraphQLError } from 'graphql'

import { getConfig, HttpClient } from './HttpClient'
import { inflightUrlWithQuery, inflightUrlWithQueryAndBody } from './middlewares/inflight'
import { RequestConfig } from './typings'

interface QueryOptions<Variables extends object> {
  query: string
  variables: Variables
  useGet?: boolean
  inflight?: boolean
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
    { query, variables, inflight }: QueryOptions<Variables>,
    config: RequestConfig = {}
  ): Promise<GraphQLResponse<Data>> => {
    const requestConfig = getConfig(config.url || '', config)
    const data = { query, variables }
    const bodyHash = createHash('md5').update(JSON.stringify(data, null, 2)).digest('hex')
    return this.http.request({
      inflightKey: inflight !== false ? inflightUrlWithQuery : undefined,
      ...requestConfig,
      data,
      method: 'get',
      params: {
        bodyHash,
      },
      headers: {'Content-Type': 'application/json',},
    })
  }

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
