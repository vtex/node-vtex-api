import Agent from 'agentkeepalive'
import axios from 'axios'
import retry, { exponentialDelay } from 'axios-retry'
import { Limit } from 'p-limit'
import { stringify } from 'qs'
import { mapObjIndexed, path, sum, toLower, values } from 'ramda'

import { renameBy } from '../../utils/renameBy'
import { isAbortedOrNetworkErrorOrRouterTimeout } from '../../utils/retry'
import { MiddlewareContext } from '../typings'

const httpAgent = new Agent({
  freeSocketTimeout: 30 * 1000,
  keepAlive: true,
  maxFreeSockets: 256,
  socketActiveTTL: 120 * 1000,
})

const http = axios.create({
  httpAgent,
})

retry(http, {
  retries: 0,
  retryCondition: isAbortedOrNetworkErrorOrRouterTimeout,
  retryDelay: exponentialDelay,
  shouldResetTimeout: true,
})

const paramsSerializer = (params: any) => {
  return stringify(params, {arrayFormat: 'repeat'})
}

export const defaultsMiddleware = (baseURL: string | undefined, rawHeaders: Record<string, string>, params: Record<string, string> | undefined, timeout: number, retries?: number, verbose?: boolean) => {
  const countByMetric: Record<string, number> = {}
  const headers = renameBy(toLower, rawHeaders)
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    ctx.config = {
      'axios-retry': retries ? { retries } : undefined,
      baseURL,
      maxRedirects: 0,
      timeout,
      validateStatus: status => (status >= 200 && status < 300),
      verbose,
      ...ctx.config,
      headers: {
        ...headers,
        ...renameBy(toLower, ctx.config.headers),
      },
      params: {
        ...params,
        ...ctx.config.params,
      },
      paramsSerializer,
    }

    if (ctx.config.verbose && ctx.config.metric) {
      const current = countByMetric[ctx.config.metric]
      countByMetric[ctx.config.metric] = (current || 0) + 1
      ctx.config.count = countByMetric[ctx.config.metric]
      ctx.config.label = `${ctx.config.metric}#${ctx.config.count}`
    }

    await next()
  }
}

const ROUTER_CACHE_KEY = 'x-router-cache'
const ROUTER_CACHE_HIT = 'HIT'
const ROUTER_CACHE_REVALIDATED = 'REVALIDATED'
const ROUTER_CACHE_KEY_PATH = ['response', 'headers', ROUTER_CACHE_KEY]
const ROUTER_RESPONSE_STATUS_PATH = ['response', 'status']

export const routerCacheMiddleware = async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  await next()

  const routerCacheHit = path(ROUTER_CACHE_KEY_PATH, ctx)
  const status = path(ROUTER_RESPONSE_STATUS_PATH, ctx)
  if (routerCacheHit === ROUTER_CACHE_HIT || (routerCacheHit === ROUTER_CACHE_REVALIDATED && status !== 304)) {
    ctx.cacheHit = {
      memory: 0,
      revalidated: 0,
      ...ctx.cacheHit,
      router: 1,
    }
  }
}

export const requestMiddleware = (limit?: Limit) => async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  const makeRequest = () => http.request(ctx.config)

  ctx.response = await (limit ? limit(makeRequest) : makeRequest())
}

function count (obj: { [key: string]: any[] }) {
  try {
    return Object.values(obj).reduce((acc, val) => acc += val.length, 0)
  } catch (_) {
    return 0
  }
}

export function httpAgentStats () {
    const sockets = count(httpAgent.sockets)
    const freeSockets = count((httpAgent as any).freeSockets)
    const pendingRequests = count(httpAgent.requests)

  return {
    freeSockets,
    pendingRequests,
    sockets,
  }
}
