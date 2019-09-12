import { Cancelation } from '../../service/typings'
import { MiddlewareContext } from '../typings'

export const cancelationToken = (cancelation?: Cancelation) => async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  const { config: { method } } = ctx

  if (!cancelation) {
    await next()
    return
  }
  if (method && method.toUpperCase() !== 'GET') {
    cancelation.cancelable = false
  }
  else if (cancelation.source) {
    ctx.config.cancelToken = cancelation.source.token
  }

  await next()
}
