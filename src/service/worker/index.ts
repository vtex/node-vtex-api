import { request } from 'http'
import Koa from 'koa'
import compress from 'koa-compress'
import Router from 'koa-router'
import { mergeDeepRight } from 'ramda'

import TokenBucket from 'tokenbucket'
import { IOClients } from '../../clients/IOClients'
import { UP_SIGNAL } from '../../constants'
import { InstanceOptions } from '../../HttpClient/typings'
import { MetricsAccumulator } from '../../metrics/MetricsAccumulator'
import { getService } from '../loaders'
import { logOnceToDevConsole } from '../logger/console'
import { LogLevel } from '../logger/logger'
import { TracerSingleton } from '../tracing/TracerSingleton'
import { addTracingMiddleware } from '../tracing/tracingMiddlewares'
import { addProcessListeners, logger } from './listeners'
import {
  healthcheckHandler,
  metricsLoggerHandler,
  whoAmIHandler,
} from './runtime/builtIn/handlers'
import {
  addMetricsLoggerMiddleware,
  prometheusLoggerMiddleware,
  recorderMiddleware,
} from './runtime/builtIn/middlewares'
import { createEventHandler } from './runtime/events'
import { routerFromEventHandlers } from './runtime/events/router'
import { createGraphQLRoute, GRAPHQL_ROUTE } from './runtime/graphql'
import { createPrivateHttpRoute, createPublicHttpRoute } from './runtime/http'
import { error } from './runtime/http/middlewares/error'
import { concurrentRateLimiter } from './runtime/http/middlewares/rateLimit'
import { routerFromPublicHttpHandlers } from './runtime/http/router'
import { logAvailableRoutes } from './runtime/http/routes'
import { Service } from './runtime/Service'
import {
  isStatusTrack,
  statusTrackHandler,
  trackStatus,
} from './runtime/statusTrack'
import {
  HttpRoute,
  ParamsContext,
  RecorderState,
  RouteHandler,
  ServiceJSON,
} from './runtime/typings'
import { createTokenBucket } from './runtime/utils/tokenBucket'

const upSignal = () => {
  const data = JSON.stringify({ statusTrack: true })

  const options = {
    headers: {
      'Content-Type': 'application/json',
    },
    host: 'localhost',
    method: 'POST',
    path: '/_up',
    port: 5000,
  }

  const req = request(options)

  req.write(data)
  req.end()
}

const isUpSignal = (message: any): message is typeof UP_SIGNAL => message === UP_SIGNAL

const onMessage = (service: ServiceJSON) => (message: any) => {
  if (isUpSignal(message)) {
    upSignal()
    logAvailableRoutes(service)
  } else if (isStatusTrack(message)) {
    trackStatus()
  } else {
    logger.warn({
      content: message,
      message: 'Master sent message',
      pid: process.pid,
    })
  }
}

interface HttpHandlerByScope {
  pub?: Record<string, HttpRoute>
  pvt?: Record<string, HttpRoute>
}

const createAppHttpHandlers = (
  { config: { routes, clients } }: Service<IOClients, RecorderState, ParamsContext>,
  serviceJSON: ServiceJSON,
  globalLimiter: TokenBucket | undefined
) => {
  if (routes && clients) {
    return Object.keys(routes).reduce(
      (acc, routeId) => {
        const serviceRoute = serviceJSON.routes?.[routeId]

        if (!serviceRoute) {
          throw new Error(`Could not find route: ${routeId}. Please add ${routeId} route in your service.json file`)
        }

        const {
          path: servicePath,
          public: publicRoute = false,
          extensible = false,
        } = serviceRoute

        if (publicRoute || extensible) {
          acc.pub[routeId] = {
            handler: createPublicHttpRoute(clients, routes[routeId], serviceRoute, routeId, globalLimiter),
            path: servicePath,
          }
        } else {
          acc.pvt[routeId] = {
            handler: createPrivateHttpRoute(clients, routes[routeId], serviceRoute, routeId, globalLimiter),
            path: `/:account/:workspace${servicePath.replace(/\*([^/]*)/g, ':$1*')}`,
          }
        }

        return acc
      },
      {
        pub: {},
        pvt: {},
      } as Required<HttpHandlerByScope>
    )
  }
  return null
}

const routerFromPrivateHttpHandlers = (routes: Record<string, HttpRoute>) => Object.values(routes).reduce(
  (router, { handler, path }) => router.all(path, handler as any),
  new Router()
)

const createAppGraphQLHandler = (
  { config: { graphql, clients } }: Service<IOClients, RecorderState, ParamsContext>,
  { routes }: ServiceJSON,
  globalLimiter: TokenBucket | undefined
): HttpHandlerByScope | null => {
  const route = routes?.[GRAPHQL_ROUTE]
  if (graphql && route && clients) {
    return {
      pvt: {
        [GRAPHQL_ROUTE]: {
          handler: createGraphQLRoute<any, any, any>(graphql, clients, route, GRAPHQL_ROUTE, globalLimiter),
          path: `/:account/:workspace${route.path}`,
        },
      },
    }
  }
  return null
}

const createAppEventHandlers = (
  { config: { events, clients } }: Service<IOClients, RecorderState, ParamsContext>,
  serviceJSON: ServiceJSON,
  globalLimiter: TokenBucket | undefined
) => {
  if (events && clients) {
    return Object.keys(events).reduce(
      (acc, eventId) => {
        const serviceEvent = serviceJSON.events?.[eventId]
        acc[eventId] = createEventHandler(clients, eventId, events[eventId], serviceEvent, globalLimiter)
        return acc
      },
      {} as Record<string, RouteHandler>
    )
  }
  return null
}

const createRuntimeHttpHandlers = (appEventHandlers: Record<string, RouteHandler> | null, serviceJSON: ServiceJSON): HttpHandlerByScope => ({
  pvt: {
    __events: {
      handler: routerFromEventHandlers(appEventHandlers),
      path: '/:account/:workspace/_events',
    },
    __healthCheck: {
      handler: healthcheckHandler(serviceJSON),
      path: '/healthcheck',
    },
    __metricsLogger: {
      handler: metricsLoggerHandler,
      path: '/_metrics',
    },
    __statusTrack: {
      handler: statusTrackHandler,
      path: '/_status',
    },
    __whoami: {
      handler: whoAmIHandler(serviceJSON),
      path: '/:account/:workspace/_whoami',
    },
  },
})

const scaleClientCaches = (
  scaleFactor: number,
  options?: Record<string, InstanceOptions>
) => Object.entries(options || {}).forEach(([name, opts]) => {
  if (opts && opts.memoryCache && scaleFactor > 1) {
    const previous = (opts.memoryCache as any).storage.max
    const current = previous / scaleFactor;
    (opts.memoryCache as any).storage.max = current
    logOnceToDevConsole(`Scaling ${name} cache capacity from ${previous} to ${current}`, LogLevel.Warn)
  }
})

export const startWorker = (serviceJSON: ServiceJSON) => {
  addProcessListeners()

  const tracer = TracerSingleton.getTracer()
  const app = new Koa()
  app.proxy = true
  app
    .use(error)
    .use(addTracingMiddleware(tracer))
    .use(prometheusLoggerMiddleware())
    .use(addTracingMiddleware(tracer))
    .use(addMetricsLoggerMiddleware())
    .use(concurrentRateLimiter(serviceJSON?.rateLimitPerReplica?.concurrent))
    .use(compress())
    .use(recorderMiddleware)

  const service = getService()

  const { config: { clients } } = service
  if (clients) {
    scaleClientCaches(serviceJSON.workers, clients.options)
  }

  const globalLimiter: TokenBucket | undefined = createTokenBucket(serviceJSON?.rateLimitPerReplica?.perMinute)
  const appHttpHandlers = createAppHttpHandlers(service, serviceJSON, globalLimiter)
  const appEventHandlers = createAppEventHandlers(service, serviceJSON, globalLimiter)
  const appGraphQLHandlers = createAppGraphQLHandler(service, serviceJSON, globalLimiter)
  const runtimeHttpHandlers = createRuntimeHttpHandlers(appEventHandlers, serviceJSON)
  const httpHandlers = [
    appHttpHandlers,
    appGraphQLHandlers,
    runtimeHttpHandlers,
  ]
  .filter(x => x != null)
  // TODO: Fix ramda typings. Apparently there was an update that broke things
  .reduce(mergeDeepRight as any)

  if (httpHandlers?.pub) {
    const publicHandlersRouter = routerFromPublicHttpHandlers(httpHandlers.pub)
    app.use(publicHandlersRouter)
  }

  if (httpHandlers?.pvt) {
    const privateHandlersRouter = routerFromPrivateHttpHandlers(httpHandlers.pvt)
    app.use(privateHandlersRouter.routes())
  }

  process.on('message', onMessage(serviceJSON))

  return app
}

global.metrics = new MetricsAccumulator()

declare global {
  namespace NodeJS {
    interface Global {
      metrics: MetricsAccumulator
    }
  }
}
