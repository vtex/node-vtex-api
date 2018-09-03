import axios from 'axios'
import {MiddlewareContext} from '../context'
import * as retry from 'axios-retry'

const http = axios.create()
retry(http)
http.interceptors.response.use(response => response, (err: any) => {
  try {
    delete err.response.request
    delete err.response.config
    delete err.config.res
    delete err.config.data
  } catch (e) {}
  return Promise.reject(err)
})

export const defaultsMiddleware = (baseURL: string, headers: Record<string, string>, timeout: number) => {
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

export const requestMiddleware = async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  ctx.response = await http.request(ctx.config)
}
