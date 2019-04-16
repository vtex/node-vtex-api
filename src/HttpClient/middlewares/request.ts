import axios from 'axios'
import retry, {IAxiosRetryConfig} from 'axios-retry'
import {Agent} from 'http'
import {Limit} from 'p-limit'
import {mapObjIndexed, sum, values} from 'ramda'

import {isAbortedOrNetworkErrorOrRouterTimeout} from '../../utils/retry'

import {MiddlewareContext} from '../context'

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
  shouldResetTimeout: true,
})

http.interceptors.response.use(response => response, (err: any) => {
  try {
    delete err.response.request
    delete err.response.config
    delete err.config.res
    delete err.config.data
  } catch (e) {} // tslint:disable-line
  return Promise.reject(err)
})

export const defaultsMiddleware = (baseURL: string | undefined, headers: Record<string, string>, timeout: number, retryConfig?: IAxiosRetryConfig) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    ctx.config = {
      'axios-retry': retryConfig, // Allow overriding default retryConfig per-request
      baseURL,
      maxRedirects: 0,
      timeout,
      validateStatus: status => (status >= 200 && status < 300),
      ...ctx.config,
      headers: {
        ...headers,
        ...ctx.config.headers,
      },
    }

    await next()
  }
}

export const requestMiddleware = (limit?: Limit) => async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  ctx.response = await (limit ? limit(() => http.request(ctx.config)) : http.request(ctx.config))
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
