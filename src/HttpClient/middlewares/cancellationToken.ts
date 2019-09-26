import { Cancellation } from '../../service/typings'
import { MiddlewareContext } from '../typings'

export const cancellationToken = (cancellation?: Cancellation) => async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  const { config: { method } } = ctx

  if (!cancellation) {
    await next()
    return
  }
  if (method && method.toUpperCase() !== 'GET') {
    cancellation.cancelable = false
  }
  else if (cancellation.source) {
    ctx.config.cancelToken = cancellation.source.token
  }

  await next()
}
