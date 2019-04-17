import { DataSource } from 'apollo-datasource'
import { GraphQLFieldConfig, GraphQLFieldResolver, GraphQLScalarType } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { ParameterizedContext } from 'koa'
import { Middleware } from 'koa-compose'
import { ParsedUrlQuery } from 'querystring'

import { ClientsImplementation, IOClientFactory, IOClients, } from '../clients/IOClients'
import { InstanceOptions } from '../HttpClient'
import { Recorder } from '../HttpClient/middlewares/recorder'

export interface Context<T extends IOClients> {
  clients: T
  vtex: IOContext
  dataSources?: DataSources
  timings: Record<string, [number, number]>
  metrics: Record<string, [number, number]>
}

type KnownKeys<T> = {
  [K in keyof T]: string extends K ? never : number extends K ? never : K
} extends { [_ in keyof T]: infer U } ? U : never
type PickByValue<T, ValueType> = Pick<
  T,
  { [Key in keyof T]: T[Key] extends ValueType ? Key : never }[keyof T]>

export type ServiceContext<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Pick<ParameterizedContext<StateT, Context<ClientsT>>, KnownKeys<ParameterizedContext<StateT, Context<ClientsT>>>> & CustomT

export type RouteHandler<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Middleware<ServiceContext<ClientsT, StateT, CustomT>>

export type Resolver<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> =
  GraphQLFieldResolver<any, ServiceContext<ClientsT, StateT, CustomT>, any>
  | GraphQLFieldConfig<any, ServiceContext<ClientsT, StateT, CustomT>, any>

export interface ClientsConfig<ClientsT extends IOClients = IOClients> {
  implementation?: ClientsImplementation<ClientsT>
  options: Record<string, ClientInstanceOptions<ClientsT>>
}

export type DataSourcesGenerator = () => {
  [name: string]: DataSource<ServiceContext>,
}

type IOClientInstances<ClientsT extends IOClients = IOClients> = keyof PickByValue<ClientsT, InstanceType<IOClientFactory>>

export interface ClientDependencies<ClientsT extends IOClients = IOClients> { depends?: { clients: Array<IOClientInstances<ClientsT>> } }

export type ClientInstanceOptions<ClientsT extends IOClients = IOClients> = InstanceOptions & ClientDependencies<ClientsT>

export type ClientContext<ClientsT extends IOClients = IOClients> = IOContext & { clients: { [k in IOClientInstances<ClientsT>]?: ClientsT[k] } }

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
  authToken: string
  production: boolean
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
