import axios from 'axios'
import retry, {IAxiosRetryConfig} from 'axios-retry'
import {Agent} from 'http'
import {Limit} from 'p-limit'

import {isAbortedOrNetworkErrorOrRouterTimeout} from '../../utils/retry'

import {MiddlewareContext} from '../context'

const http = axios.create({
  httpAgent: new Agent({
    keepAlive: true,
    maxFreeSockets: 50,
  }),
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
