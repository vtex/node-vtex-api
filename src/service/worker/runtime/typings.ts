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
import { Span, Tracer } from 'opentracing'
import { ParsedUrlQuery } from 'querystring'

import { ClientsImplementation, IOClients } from '../../../clients/IOClients'
import { InstanceOptions } from '../../../HttpClient'
import { IUserLandTracer } from '../../../tracing/UserLandTracer'
import { BindingHeader } from '../../../utils/binding'
import { IOMessage } from '../../../utils/message'
import { TenantHeader } from '../../../utils/tenant'
import { Logger } from '../../logger'
import { MetricsLogger } from '../../logger/metricsLogger'
import { MessagesLoaderV2 } from './graphql/schema/messagesLoaderV2'
import { Recorder } from './utils/recorder'

type ServerTiming = Record<string, string>

export type Maybe<T> = T | null | undefined

export interface TracingContext {
  tracer: Tracer
  currentSpan: Span | undefined
}

export interface Context<T extends IOClients> {
  clients: T
  vtex: IOContext
  timings: Record<string, [number, number]>
  metrics: Record<string, [number, number]>
  previousTimerStart: [number, number]
  requestHandlerName?: string
  serverTiming?: ServerTiming
  tracing?: TracingContext
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
  messagesV2?: MessagesLoaderV2
  immutableMessagesV2?: MessagesLoaderV2
}

export type ServiceContext<ClientsT extends IOClients = IOClients, StateT extends RecorderState = RecorderState, CustomT extends ParamsContext = ParamsContext> = Pick<ParameterizedContext<StateT, Context<ClientsT>>, KnownKeys<ParameterizedContext<StateT, Context<ClientsT>>>> & CustomT & { loaders?: Loaders }

export type RouteHandler<ClientsT extends IOClients = IOClients, StateT extends RecorderState = RecorderState, CustomT extends ParamsContext = ParamsContext> = Middleware<ServiceContext<ClientsT, StateT, CustomT>>

export type EventHandler<ClientsT extends IOClients = IOClients, StateT = void> = Middleware<EventContext<ClientsT, StateT>>

export type Resolver<ClientsT extends IOClients = IOClients, StateT extends RecorderState = RecorderState, CustomT extends ParamsContext = ParamsContext> =
  GraphQLFieldResolver<any, ServiceContext<ClientsT, StateT, CustomT>, any>
  | GraphQLFieldConfig<any, ServiceContext<ClientsT, StateT, CustomT>, any>

export type Handler = RouteHandler<IOClients, RecorderState, ParamsContext>

export interface HttpRoute {
  handler: RouteHandler
  path: string
}

export interface RecorderState {
  recorder: Recorder
  body: any
}

export interface ParamsContext {
  params: any
  metricsLogger: MetricsLogger
}

export interface ClientsConfig<ClientsT extends IOClients = IOClients> {
  implementation?: ClientsImplementation<ClientsT>
  options: Record<string, InstanceOptions>
}

export interface GraphQLOptions<ClientsT extends IOClients = IOClients, StateT extends RecorderState = RecorderState, CustomT extends ParamsContext = ParamsContext> {
  resolvers: Record<string, Record<string, Resolver<ClientsT, StateT, CustomT>> | GraphQLScalarType>
  schema?: string
  schemaDirectives?: Record<string, typeof SchemaDirectiveVisitor>
}

export interface ServiceConfig<ClientsT extends IOClients = IOClients, StateT extends RecorderState = RecorderState, CustomT extends ParamsContext = ParamsContext> {
  clients?: ClientsConfig<ClientsT>
  events?: Record<string, EventHandler<ClientsT, StateT> | Array<EventHandler<ClientsT, StateT>>>,
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
    type: 'public' | 'private' | 'event'
  }
  userAgent: string
  workspace: string
  segmentToken?: string
  searchSegmentToken?: string
  sessionToken?: string
  requestId: string
  operationId: string
  // Admins may send a cookie in the request to indicate they should be routed to a specific environment, e.g. beta.
  janusEnv?: JanusEnv
  serverTiming?: ServerTiming
  logger: Logger
  eventInfo?: EventBody
  host?: string
  tenant?: TenantHeader
  binding?: BindingHeader
  cancellation?: Cancellation
  // Some services may receive settings from other apps in the request
  settings?: any
  tracer: IUserLandTracer
}

export interface EventBody {
  sender: string,
  subject: string,
  key: string,
}

export type RouteSettingsType = 'pure' | 'workspace' | 'userAndWorkspace'

export interface ServiceRoute {
  path: string,
  public?: boolean,
  smartcache?: boolean,
  extensible?: boolean,
  settingsType?: RouteSettingsType,
  rateLimitPerReplica?: RateLimitOptions
}

export interface ServiceEvent {
  keys?: string[],
  sender?: string,
  subject?: string,
  settingsType?: RouteSettingsType,
  rateLimitPerReplica?: RateLimitOptions
}

export interface RateLimitOptions {
  perMinute?: number,
  concurrent?: number
}

export interface RawServiceJSON {
  stack: 'nodejs',
  memory: number,
  ttl?: number,
  timeout?: number,
  runtimeArgs?: string[],
  routes?: Record<string, ServiceRoute>,
  rateLimitPerReplica?: RateLimitOptions
  events?: Record<string, ServiceEvent>,
  minReplicas?: number,
  maxReplicas?: number,
  workers?: number
  deterministicVary?: boolean
}

export interface ServiceJSON extends RawServiceJSON {
  workers: number
}

export type JanusEnv = string
