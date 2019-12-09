import { ServiceContext, ServiceJSON, ServiceRuntimeContext } from '../typings'

export const whoAmIHandler = ({
  events,
  routes,
}: ServiceJSON) => (ctx: ServiceContext) => {
  ctx.status = 200
  ctx.body = {
    events,
    routes,
  }
  ctx.set('Cache-Control', 'public, max-age=86400') // cache for 24 hours
}

export const healthcheckHandler = ({
  events,
  routes,
}: ServiceJSON) => (ctx: ServiceContext) => {
  ctx.status = 200
  ctx.body = {
    events,
    routes,
  }
}

export const metricsLoggerHandler = (ctx: ServiceRuntimeContext) => {
  ctx.status = 200
  ctx.body = ctx.metricsLogger.getSummaries()
}
