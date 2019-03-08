import {AxiosRequestConfig} from 'axios'
import {MiddlewareContext} from '../context'

const addNotFound = (validateStatus: (status: number) => boolean) =>
  (status: number) => validateStatus(status) || status === 404

function nullIfNotFound (config: any): boolean {
  return config && config.nullIfNotFound
}

export const acceptNotFoundMiddleware = async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  console.error('acceptNotFoundMiddleware')
  const {config} = ctx
  if (nullIfNotFound(config)) {
    ctx.config.validateStatus = addNotFound(config.validateStatus!)
  }

  await next()
}

export const notFoundFallbackMiddleware = async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  console.error('notFoundFallbackMiddleware')
  await next()

  const {config} = ctx
  if (nullIfNotFound(config) && ctx.response && ctx.response.status === 404) {
    ctx.response.data = null
  }
}

export type IgnoreNotFoundRequestConfig = AxiosRequestConfig & {
  nullIfNotFound?: boolean,
}
