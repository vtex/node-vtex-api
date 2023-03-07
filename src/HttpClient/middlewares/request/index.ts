import { AxiosRequestConfig } from 'axios'
import buildFullPath from 'axios/lib/core/buildFullPath'
import { Limit } from 'p-limit'
import { stringify } from 'qs'
import { toLower } from 'ramda'


import { CustomHttpTags, OpentracingTags } from '../../../tracing/Tags'
import { renameBy } from '../../../utils/renameBy'
import { MiddlewareContext } from '../../typings'
import { getConfiguredAxios } from './setupAxios'

const http = getConfiguredAxios()

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
  httpsAgent?: AxiosRequestConfig['httpsAgent']
}

export const defaultsMiddleware = ({ baseURL, rawHeaders, params, timeout, retries, verbose, exponentialTimeoutCoefficient, initialBackoffDelay, exponentialBackoffCoefficient, httpsAgent }: DefaultMiddlewareArgs) => {
  const countByMetric: Record<string, number> = {}
  const headers = renameBy(toLower, rawHeaders)
  return (ctx: MiddlewareContext, next: () => Promise<void>) => {
    ctx.config = {
      baseURL,
      exponentialBackoffCoefficient,
      exponentialTimeoutCoefficient,
      httpsAgent: ctx.config.httpsAgent || httpsAgent,
      initialBackoffDelay,
      maxRedirects: 0,
      retries,
      timeout,
      validateStatus: status => (status >= 200 && status < 300),
      verbose,
      ...ctx.config,
      headers: {
        ...headers,
        ...renameBy(toLower, ctx.config.headers!),
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


    if(ctx.tracing!.isSampled) {
      const { config } = ctx
      const fullUrl = buildFullPath(config.baseURL, http.getUri(config))
      ctx.tracing!.rootSpan.addTags({
        [OpentracingTags.HTTP_METHOD]: config.method || 'get',
        [OpentracingTags.HTTP_URL]: fullUrl,
      })
    }

    return next()
  }
}

const ROUTER_CACHE_KEY = 'x-router-cache'
const ROUTER_CACHE_HIT = 'HIT'
const ROUTER_CACHE_REVALIDATED = 'REVALIDATED'

export const routerCacheMiddleware = async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  await next()

  const routerCacheHit = ctx.response?.headers?.[ROUTER_CACHE_KEY]
  const status = ctx.response?.status

  if(routerCacheHit) {
    ctx.tracing!.rootSpan.setTag(CustomHttpTags.HTTP_ROUTER_CACHE_RESULT, routerCacheHit)
  }

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