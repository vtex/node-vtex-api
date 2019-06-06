import { DataSource } from 'apollo-datasource'
import { GraphQLFieldConfig, GraphQLFieldResolver, GraphQLScalarType } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { ParameterizedContext } from 'koa'
import { Middleware } from 'koa-compose'
import { ParsedUrlQuery } from 'querystring'

import { ClientsImplementation, IOClients } from '../clients/IOClients'
import { InstanceOptions } from '../HttpClient'
import { Recorder } from '../HttpClient/middlewares/recorder'

interface BaseContext<T extends IOClients> {
  clients: T
  dataSources?: DataSources
  timings: Record<string, [number, number]>
  metrics: Record<string, [number, number]>
}

export interface Context<T extends IOClients> extends BaseContext<T> {
  vtex: IOContext
}

export interface EventContext<T extends IOClients> extends BaseContext<T> {
  vtex: EventIOContext
}

type KnownKeys<T> = {
  [K in keyof T]: string extends K ? never : number extends K ? never : K
} extends { [_ in keyof T]: infer U } ? U : never

export type ServiceContext<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Pick<ParameterizedContext<StateT, Context<ClientsT>>, KnownKeys<ParameterizedContext<StateT, Context<ClientsT>>>> & CustomT

export type EventServiceContext<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = EventContext<ClientsT> & { state: StateT } & CustomT

export type RouteHandler<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Middleware<ServiceContext<ClientsT, StateT, CustomT>>

export type EventHandler<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Middleware<EventServiceContext>

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
  events?: Record<string, EventHandler<ClientsT, StateT, CustomT> | Array<EventHandler<ClientsT, StateT, CustomT>>>,
  graphql?: GraphQLOptions<ClientsT, StateT, CustomT>,
  routes?: Record<string, RouteHandler<ClientsT, StateT, CustomT> | Array<RouteHandler<ClientsT, StateT, CustomT>>>
}

export interface DataSources {
  [name: string]: DataSource<ServiceContext>,
}

export interface BaseIOContext {
  account: string
  // Identifies current app for the VTEX IO infrastructure.
  authToken: string
  production: boolean
  recorder?: Recorder
  region: string
  // TODO: segmentToken was placed in BaseIOContext only because Segment client uses it. Think about this.
  segmentToken?: string
  userAgent: string
  workspace: string
  requestId: string
  operationId: string
}

export interface IOContext extends BaseIOContext {
  // Identifies the user based on the cookie `VtexIdclientAutCookie`. Cookies are only available in private routes.
  adminUserAuthToken?: string
  // Identifies the user based on the cookie `VtexIdclientAutCookie_${account}`. Cookies are only available in private routes.
  storeUserAuthToken?: string
  sessionToken?: string
  route: {
    declarer?: string
    id: string
    params: ParsedUrlQuery
  }
}

// tslint:disable-next-line:no-empty-interface
export interface EventIOContext extends BaseIOContext {}

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
  events?: {
    [handler: string]: {
      keys?: string[],
      sender?: string,
      subject?: string,
    },
  },
}
