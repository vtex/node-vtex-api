import Agent from 'agentkeepalive'
import axios, { AxiosInstance } from 'axios'
import { Limit } from 'p-limit'
import { stringify } from 'qs'
import { mapObjIndexed, path, sum, toLower, values } from 'ramda'

import { renameBy } from '../../utils/renameBy'
import { isAbortedOrNetworkErrorOrRouterTimeout } from '../../utils/retry'
import { MiddlewareContext, RequestConfig } from '../typings'

const httpAgent = new Agent({
  freeSocketTimeout: 15 * 1000,
  keepAlive: true,
  maxFreeSockets: 50,
})

const http = axios.create({
  httpAgent,
})

function fixConfig(axiosInstance: AxiosInstance, config: RequestConfig) {
  if (axiosInstance.defaults.httpAgent === config.httpAgent) {
    delete config.httpAgent
  }
  if (axiosInstance.defaults.httpsAgent === config.httpsAgent) {
    delete config.httpsAgent
  }
}

const exponentialDelay = (initialBackoffDelay: number, exponentialBackoffCoefficient: number, retryNumber: number) => {
  const delay = initialBackoffDelay * exponentialBackoffCoefficient ** (retryNumber - 1)
  const randomSum = delay * 0.2 * Math.random()
  return delay + randomSum
}

// A lot of this code is based on:
// https://github.com/softonic/axios-retry/blob/ffd4327f31d063522e58c525d28d4c5053d0ea7b/es/index.js#L109
http.interceptors.response.use(undefined, error => {
  if (error.config == null) {
    return Promise.reject(error)
  }

  const config = error.config as RequestConfig

  if (config.retries == null || config.retries === 0) {
    return Promise.reject(error)
  }
  const { initialBackoffDelay = 200, exponentialBackoffCoefficient = 2, exponentialTimeoutCoefficient } = config
  const retryCount = config.retryCount ?? 0
  const shouldRetry = isAbortedOrNetworkErrorOrRouterTimeout(error) && retryCount < config.retries
  if (shouldRetry) {
    config.retryCount = retryCount + 1
    const delay = exponentialDelay(initialBackoffDelay, exponentialBackoffCoefficient, config.retryCount)

    // Axios fails merging this configuration to the default configuration because it has an issue
    // with circular structures: https://github.com/mzabriskie/axios/issues/370
    fixConfig(http, config)

    config.timeout = exponentialTimeoutCoefficient
      ? (config.timeout as number) * exponentialTimeoutCoefficient
      : config.timeout
    config.transformRequest = [data => data]

    return new Promise(resolve => setTimeout(() => resolve(http(config)), delay))
  }
  return Promise.reject(error)
})

const paramsSerializer = (params: any) => {
  return stringify(params, { arrayFormat: 'repeat' })
}

export interface DefaultMiddlewareArgs {
  baseURL: string | undefined
  rawHeaders: Record<string, string>
  params: Record<string, string> | undefined
  timeout: number
  retries?: number
  verbose?: boolean
  exponentialTimeoutCoefficient?: number
  initialBackoffDelay?: number
  exponentialBackoffCoefficient?: number
}

export const defaultsMiddleware = ({
  baseURL,
  rawHeaders,
  params,
  timeout,
  retries,
  verbose,
  exponentialTimeoutCoefficient,
  initialBackoffDelay,
  exponentialBackoffCoefficient,
}: DefaultMiddlewareArgs) => {
  const countByMetric: Record<string, number> = {}
  const headers = renameBy(toLower, rawHeaders)
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    ctx.config = {
      baseURL,
      exponentialBackoffCoefficient,
      exponentialTimeoutCoefficient,
      initialBackoffDelay,
      maxRedirects: 0,
      retries,
      timeout,
      validateStatus: status => status >= 200 && status < 300,
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
      retryCount: 0,
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

function countPerOrigin(obj: { [key: string]: any[] }) {
  try {
    return mapObjIndexed(val => val.length, obj)
  } catch (_) {
    return {}
  }
}

export function httpAgentStats() {
  const socketsPerOrigin = countPerOrigin(httpAgent.sockets)
  const sockets = sum(values(socketsPerOrigin))
  const freeSocketsPerOrigin = countPerOrigin((httpAgent as any).freeSockets)
  const freeSockets = sum(values(freeSocketsPerOrigin))
  const pendingRequestsPerOrigin = countPerOrigin(httpAgent.requests)
  const pendingRequests = sum(values(pendingRequestsPerOrigin))

  return {
    freeSockets,
    freeSocketsPerOrigin,
    pendingRequests,
    pendingRequestsPerOrigin,
    sockets,
    socketsPerOrigin,
  }
}
