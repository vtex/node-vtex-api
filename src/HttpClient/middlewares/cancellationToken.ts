import { Cancellation } from '../../service/typings'
import { MiddlewareContext } from '../typings'

const production = process.env.VTEX_PRODUCTION === 'true'

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
    if (!cancellation.source.token.throwIfRequested && !production) {
      throw new Error('Missing cancellation function. Are you trying to use HttpClient via workers threads?')
    } else {
      ctx.config.cancelToken = cancellation.source.token
    }
  }

  await next()
}
