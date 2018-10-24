import axios, { AxiosInstance } from 'axios'
import * as retry from 'axios-retry'
import {Agent} from 'http'

import {MiddlewareContext} from '../context'

export const getAxiosInstance = (retries: number) => {
  const http = axios.create({
    httpAgent: new Agent({
      keepAlive: true,
      maxFreeSockets: 50,
    }),
  })

  retry(http, {
    retries,
    retryDelay: retry.exponentialDelay
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

  return http
}

export const defaultsMiddleware = (baseURL: string | undefined, headers: Record<string, string>, timeout: number) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    ctx.config = {
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

export const requestMiddleware = (http: AxiosInstance) => async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  ctx.response = await http.request(ctx.config)
}
