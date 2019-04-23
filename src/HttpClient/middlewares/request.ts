import axios from 'axios'
import retry, {exponentialDelay} from 'axios-retry'
import {Agent} from 'http'
import {Limit} from 'p-limit'
import {mapObjIndexed, sum, values} from 'ramda'

import {isAbortedOrNetworkErrorOrRouterTimeout} from '../../utils/retry'
import {hrToMillis} from '../../utils/time'

import {MiddlewareContext} from '../typings'

const httpAgent = new Agent({
  keepAlive: true,
  maxFreeSockets: 50,
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

export const defaultsMiddleware = (baseURL: string | undefined, headers: Record<string, string>, params: Record<string, string> | undefined, timeout: number, retries?: number, verbose?: boolean) => {
  const countByMetric: Record<string, number> = {}
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
        ...ctx.config.headers,
      },
      params: {
        ...params,
        ...ctx.config.params,
      },
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

export const requestMiddleware = (limit?: Limit) => async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  const makeRequest = () => {
    let start: [number, number] | undefined

    if (ctx.config.verbose && ctx.config.label) {
      start = process.hrtime()
      console.log(ctx.config.label, `start`)
    }

    return http.request(ctx.config).then((r) => {
      if (start) {
        const end = process.hrtime(start)
        const millis = hrToMillis(end)
        console.log(ctx.config.label, `millis=${millis} status=${r.status}`)
      }

      return r
    }).catch((e) => {
      if (start) {
        const end = process.hrtime(start)
        const millis = hrToMillis(end)
        console.log(ctx.config.label, `millis=${millis} code=${e.code} ${e.response ? `status=${e.response.status}` : ''}`)
      }

      throw e
    })
  }

  ctx.response = await (limit ? limit(makeRequest) : makeRequest())
}

function countPerOrigin (obj: { [key: string]: any[] }) {
  try {
    return mapObjIndexed(val => val.length, obj)
  } catch (_) {
    return {}
  }
}

export function httpAgentStats () {
  const socketsPerOrigin = countPerOrigin(httpAgent.sockets)
  const sockets = sum(values(socketsPerOrigin))
  const pendingRequestsPerOrigin = countPerOrigin(httpAgent.requests)
  const pendingRequests = sum(values(pendingRequestsPerOrigin))

  return {
    pendingRequests,
    pendingRequestsPerOrigin,
    sockets,
    socketsPerOrigin,
  }
}
