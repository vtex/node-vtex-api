import { DataSource } from 'apollo-datasource'
import DataLoader from 'dataloader'
import { GraphQLFieldConfig, GraphQLFieldResolver, GraphQLScalarType } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { ParameterizedContext } from 'koa'
import { Middleware } from 'koa-compose'
import { ParsedUrlQuery } from 'querystring'

import { ClientsImplementation, IOClients } from '../clients/IOClients'
import { InstanceOptions } from '../HttpClient'
import { Recorder } from '../HttpClient/middlewares/recorder'
import { IOMessage } from '../utils/message'
import { Logger } from './logger'

type ServerTiming = Record<string, string>

export interface Context<T extends IOClients> {
  clients: T
  vtex: IOContext
  dataSources?: DataSources
  timings: Record<string, [number, number]>
  metrics: Record<string, [number, number]>
  serverTiming?: ServerTiming
}

type KnownKeys<T> = {
  [K in keyof T]: string extends K ? never : number extends K ? never : K
} extends { [_ in keyof T]: infer U } ? U : never

interface Loaders {
  messages?: DataLoader<IOMessage, string>
}

export type ServiceContext<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Pick<ParameterizedContext<StateT, Context<ClientsT>>, KnownKeys<ParameterizedContext<StateT, Context<ClientsT>>>> & CustomT & { loaders: Loaders }

export type RouteHandler<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Middleware<ServiceContext<ClientsT, StateT, CustomT>>

export type Resolver<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> =
  GraphQLFieldResolver<any, ServiceContext<ClientsT, StateT, CustomT>, any>
  | GraphQLFieldConfig<any, ServiceContext<ClientsT, StateT, CustomT>, any>

export interface ClientsConfig<ClientsT extends IOClients = IOClients> {
  implementation?: ClientsImplementation<ClientsT>
  options: Record<string, InstanceOptions>
}

export type DataSourcesGenerator = () => {
  [name: string]: DataSource<ServiceContext>,
}

export interface GraphQLOptions<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> {
  resolvers: Record<string, Record<string, Resolver<ClientsT, StateT, CustomT>> | GraphQLScalarType>
  dataSources?: DataSourcesGenerator
  schemaDirectives?: Record<string, typeof SchemaDirectiveVisitor>
}

export interface ServiceConfig<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> {
  clients?: ClientsConfig<ClientsT>
  events?: any,
  graphql?: GraphQLOptions<ClientsT, StateT, CustomT>,
  routes?: Record<string, RouteHandler<ClientsT, StateT, CustomT> | Array<RouteHandler<ClientsT, StateT, CustomT>>>
}

export interface DataSources {
  [name: string]: DataSource<ServiceContext>,
}

export interface IOContext {
  account: string
  // Identifies current app for the VTEX IO infrastructure.
  authToken: string
  // Identifies the user based on the cookie `VtexIdclientAutCookie`. Cookies are only available in private routes.
  adminUserAuthToken?: string
  // Identifies the user based on the cookie `VtexIdclientAutCookie_${account}`. Cookies are only available in private routes.
  storeUserAuthToken?: string
  locale?: string
  production: boolean
  product: string
  recorder?: Recorder
  region: string
  route: {
    declarer?: string
    id: string
    params: ParsedUrlQuery
  }
  userAgent: string
  workspace: string
  segmentToken?: string
  sessionToken?: string
  requestId: string
  operationId: string
  // Admins may send a cookie in the request to indicate they should be routed to a specific environment, e.g. beta.
  janusEnv?: JanusEnv
  serverTiming?: ServerTiming
  logger?: Logger
}

export interface ServiceRoute {
  path: string,
  method?: string[],
  public?: boolean,
  smartcache?: boolean,
}

export interface ServiceDescriptor {
  stack: 'nodejs',
  memory: number,
  ttl?: number,
  timeout?: number,
  runtimeArgs?: string[],
  routes?: Record<string, ServiceRoute>,
  events: {
    [handler: string]: {
      keys?: string[],
      sender?: string,
      subject?: string,
    },
  },
}

export type JanusEnv = string
