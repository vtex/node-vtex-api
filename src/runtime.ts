import { DataSource } from 'apollo-datasource'
import { KeyValueCache } from 'apollo-server-caching'
import { IDirectiveResolvers } from 'graphql-tools'

import { ServiceContext } from './HttpClient'
import { Metric } from './metrics/metricsAccumulator'

export type StatusTrack = () => Metric[]

export type DataSourcesGenerator = () => {
  [name: string]: DataSource<ServiceContext>,
}

export interface GraphQLOptions {
  resolvers: any
  dataSources?: DataSourcesGenerator
  schemaDirectives?: IDirectiveResolvers<any, ServiceContext>
  cache?: () => KeyValueCache
}

export type Route = (ctx: ServiceContext) => Promise<void>

export interface Routes {
  [route: string]: Route
}

export interface RuntimeOptions {
  events?: any,
  statusTrack?: StatusTrack,
  routes?: Routes,
  graphql?: GraphQLOptions,
  dataSources?: DataSourcesGenerator
  cache?: KeyValueCache
}
