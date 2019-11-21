import { CancelTokenSource } from 'axios'
import DataLoader from 'dataloader'
import {
  GraphQLFieldConfig,
  GraphQLFieldResolver,
  GraphQLScalarType,
} from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { ParameterizedContext } from 'koa'
import { Middleware } from 'koa-compose'
import { ParsedUrlQuery } from 'querystring'

import { ClientsImplementation, IOClients } from '../clients/IOClients'
import { IOMessageV2 } from '../clients/MessagesGraphQL'
import { InstanceOptions } from '../HttpClient'
import { Recorder } from '../HttpClient/middlewares/recorder'
import { Binding } from '../utils/binding'
import { IOMessage } from '../utils/message'
import { Tenant } from '../utils/tenant'
import { Logger } from './logger'

type ServerTiming = Record<string, string>

export interface Context<T extends IOClients> {
  clients: T
  vtex: IOContext
  timings: Record<string, [number, number]>
  metrics: Record<string, [number, number]>
  previousTimerStart: [number, number]
  serverTiming?: ServerTiming
}

export interface EventContext<T extends IOClients, StateT = any> {
  clients: T
  state: StateT
  vtex: IOContext
  body: any
  timings: Record<string, [number, number]>
  metrics: Record<string, [number, number]>
  key: string
  sender: string
  subject: string
}

type KnownKeys<T> = {
  [K in keyof T]: string extends K ? never : number extends K ? never : K
} extends { [_ in keyof T]: infer U } ? U : never

interface Loaders {
  messages?: DataLoader<IOMessage, string>
  messagesV2?: DataLoader<IOMessageV2, string>
}

export type ServiceContext<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Pick<ParameterizedContext<StateT, Context<ClientsT>>, KnownKeys<ParameterizedContext<StateT, Context<ClientsT>>>> & CustomT & { loaders: Loaders }

export type RouteHandler<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> = Middleware<ServiceContext<ClientsT, StateT, CustomT>>

export type EventHandler<ClientsT extends IOClients = IOClients, StateT = void> = Middleware<EventContext<ClientsT, StateT>>

export type Resolver<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> =
  GraphQLFieldResolver<any, ServiceContext<ClientsT, StateT, CustomT>, any>
  | GraphQLFieldConfig<any, ServiceContext<ClientsT, StateT, CustomT>, any>

export interface ClientsConfig<ClientsT extends IOClients = IOClients> {
  implementation?: ClientsImplementation<ClientsT>
  options: Record<string, InstanceOptions>
}

export interface GraphQLOptions<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> {
  resolvers: Record<string, Record<string, Resolver<ClientsT, StateT, CustomT>> | GraphQLScalarType>
  schemaDirectives?: Record<string, typeof SchemaDirectiveVisitor>
}

export interface ServiceConfig<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> {
  clients?: ClientsConfig<ClientsT>
  events?: any,
  graphql?: GraphQLOptions<ClientsT, StateT, CustomT>,
  routes?: Record<string, RouteHandler<ClientsT, StateT, CustomT> | Array<RouteHandler<ClientsT, StateT, CustomT>>>
}

export interface Cancellation {
  cancelable: boolean
  cancelled: boolean
  source: CancelTokenSource
}

export interface IOContext {
  account: string
  platform: string
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
  logger: Logger
  eventInfo?: EventBody
  host?: string
  tenant?: Tenant
  binding?: Binding
  cancellation?: Cancellation
}

export interface EventBody {
  sender: string,
  subject: string,
  key: string,
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
  events?: {
    [handler: string]: {
      keys?: string[],
      sender?: string,
      subject?: string,
    },
  },
  minReplicas?: number,
  maxReplicas?: number,
  workers?: 'automatic' | number
}

export type JanusEnv = string
