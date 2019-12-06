import { request } from 'http'
import Koa from 'koa'
import compress from 'koa-compress'
import Router from 'koa-router'
import { mergeDeepRight } from 'ramda'

import { IOClients } from '../../clients/IOClients'
import { UP_SIGNAL } from '../../constants'
import { InstanceOptions } from '../../HttpClient/typings'
import { MetricsAccumulator } from '../../metrics/MetricsAccumulator'
import { addProcessListeners, logger } from '../../utils/unhandled'
import { getService } from '../loaders'
import { logOnceToDevConsole } from '../logger/console'
import { LogLevel } from '../logger/logger'
import { createEventHandler } from './runtime/events'
import { routerFromEventHandlers } from './runtime/events/router'
import { createGraphQLRoute, GRAPHQL_ROUTE } from './runtime/graphql'
import { createPrivateHttpRoute, createPublicHttpRoute } from './runtime/http'
import { routerFromPublicHttpHandlers } from './runtime/http/router'
import { logAvailableRoutes } from './runtime/http/routes'
import {
  addMetricsLoggerMiddleware,
  healthcheckHandler,
  metricsLoggerHandler,
  prometheusLoggerMiddleware,
  recorderMiddleware,
  whoAmIHandler,
} from './runtime/middlewares'
import { Service } from './runtime/Service'
import {
  isStatusTrack,
  statusTrackHandler,
  trackStatus,
} from './runtime/statusTrack'
import { ParamsContext, RecorderState, ServiceJSON } from './runtime/typings'

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

const createAppHttpHandlers = (
  { config: { routes, clients }}: Service<IOClients, RecorderState, ParamsContext>,
  serviceJSON: ServiceJSON
) => Object.keys(routes || {}).reduce(
  (acc, routeId) => {
    const serviceRoute = serviceJSON.routes?.[routeId]

    if (!serviceRoute) {
      throw new Error(`Could not find route: ${routeId}. Please add ${routeId} route in your service.json file`)
    }

    const {
      path: servicePath,
      public: publicRoute = false,
    } = serviceRoute

    if (publicRoute) {
      acc.pub[routeId] = {
        handler: createPublicHttpRoute(clients!, routes![routeId], serviceRoute, routeId),
        path: servicePath,
      }
    } else {
      acc.pvt[routeId] = {
        handler: createPrivateHttpRoute(clients!, routes![routeId], serviceRoute, routeId),
        path: `/:account/:workspace${servicePath.replace(/\*([^/]*)/g, ':$1*')}`,
      }
    }

    return acc
  },
  {
    // TODO: fix this before shipping 🚢🚢🚢
    pub: {} as Record<string, any>,
    pvt: {} as Record<string, any>,
  }
)

const routerFromPrivateHttpHandlers = (routes: Record<string, any>) => Object.values(routes).reduce(
  (router, { handler, path }) => router.all(path, handler),
  new Router()
)

const createAppGraphQLHandler = (
  { config: { graphql, clients } }: Service<IOClients, RecorderState, ParamsContext>,
  { routes }: ServiceJSON
) => {
  const route = routes?.[GRAPHQL_ROUTE]
  if (graphql && route) {
    return {
      pvt: {
        [GRAPHQL_ROUTE]: {
          handler: createGraphQLRoute<any, any, any>(graphql, clients!, route!, GRAPHQL_ROUTE),
          path: route!.path,
        },
      },
    }
  }
  return {}
}

const createAppEventHandlers = (
  { config: { events, clients } }: Service<IOClients, RecorderState, ParamsContext>
) => Object.keys(events || {}).reduce(
  (acc, eventId) => {
    acc[eventId] = createEventHandler(clients!, events![eventId])
    return acc
  },
  {} as Record<string, any>
)

const createRuntimeHttpHandlers = (appEventHandlers: Record<string, any>, serviceJSON: ServiceJSON) => ({
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
  const app = new Koa()
  app.proxy = true

  const service = getService()
  const { config: { clients, events } } = service
  const { options } = clients!
  scaleClientCaches(serviceJSON.workers, options)

  const appHttpHandlers = createAppHttpHandlers(service, serviceJSON)
  const appGraphQLHandlers = createAppGraphQLHandler(service, serviceJSON)
  const appEventHandlers = createAppEventHandlers(service)
  const runtimeHttpHandlers = createRuntimeHttpHandlers(appEventHandlers, serviceJSON)

  // TODO: remove this any before shipping 🚢🚢🚢
  const httpHandlers = [
    appHttpHandlers,
    appGraphQLHandlers,
    runtimeHttpHandlers,
  ].reduce(mergeDeepRight)

  // TODO: fix this before shipping 🚢🚢🚢
  const privateHandlersRouter = routerFromPrivateHttpHandlers((httpHandlers as any).pvt)
  const publicHandlersRouter = routerFromPublicHttpHandlers((httpHandlers as any).pub)

  // TODO: Make events Work
  // const eventHandlers = mapObjIndexed(
  //   createEventHandler<any, any, any>(implementation!, options!),
  //   events || {}
  // )

  addProcessListeners()
  process.on('message', onMessage(serviceJSON))

  app
    .use(addMetricsLoggerMiddleware())
    .use(compress())
    .use(recorderMiddleware)
    .use(prometheusLoggerMiddleware())
    .use(publicHandlersRouter)
    .use(privateHandlersRouter.routes())

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
