import { DataSource } from 'apollo-datasource'
import { ParameterizedContext } from 'koa'
import { Middleware } from 'koa-compose'
import { ParsedUrlQuery } from 'querystring'

import { ClientsImplementation, IOClients } from '../clients/IOClients'
import { InstanceOptions } from '../HttpClient'
import { Recorder } from '../HttpClient/middlewares/recorder'
import { MetricsLogger } from '../metrics/logger'

export interface Context<T extends IOClients> {
  clients: T
  vtex: IOContext
  dataSources?: DataSources
  metricsLogger?: MetricsLogger
  timings: Record<string, [number, number]>
  metrics: Record<string, [number, number]>
}

export type ServiceContext<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = ParameterizedContext<StateT, Context<ClientsT> & CustomT>

export type RouteHandler<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Middleware<ServiceContext<ClientsT, StateT, CustomT>>

export interface ClientsConfig<ClientsT extends IOClients> {
  implementation?: ClientsImplementation<ClientsT>
  options: Record<string, InstanceOptions>
}

export interface ServiceConfig<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> {
  routes: Record<string, RouteHandler<ClientsT, StateT, CustomT> | Array<RouteHandler<ClientsT, StateT, CustomT>>>
  clients: ClientsConfig<ClientsT>
}

export interface DataSources {
  [name: string]: DataSource<ServiceContext>,
}

export interface IOContext {
  account: string,
  authToken: string,
  production: boolean,
  recorder?: Recorder,
  region: string,
  route: {
    declarer?: string
    id: string
    params: ParsedUrlQuery,
  }
  userAgent: string,
  workspace: string,
  segmentToken?: string
  sessionToken?: string
}
