import axios from 'axios'
import { Cancellation } from '../../service/typings'
import { MiddlewareContext } from '../typings'

const production = process.env.VTEX_PRODUCTION === 'true'

const handleCancellation = (ctx: MiddlewareContext, cancellation: Cancellation) => {
  let cancellable = true
  return {
    cancelToken: new axios.CancelToken((canceller) => {
      cancellation.source.token.promise.then(cancel => {
        if (cancellable) {
          canceller(cancel.message)
        }
      })
    }),
    onRequestFinish: () => {
      if (!ctx.config.cancelToken) {
        // don't have cancelToken: not cancelable
        cancellable = false
      } else if (!ctx.response) {
        // response is not ready: cancelable
        cancellable = true
      } else if (ctx.config.responseType !== 'stream') {
        // response is ready and it is not a stream: not cancelable
        cancellable = false
      } else if (ctx.response.data.readableEnded) {
        // response stream has ended: not cancelable
        cancellable = false
      } else {
        // when response stream ends: not cancelable
        ctx.response.data.on('end', function streamEnded() {
          cancellable = false
        })
      }
    },
  }
}

export const cancellationToken = (cancellation?: Cancellation) => async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  const { config: { method } } = ctx

  if (!cancellation) {
    return await next()
  }

  if (method && method.toUpperCase() !== 'GET') {
    cancellation.cancelable = false
  }

  if (!cancellation.cancelable || !cancellation.source) {
    return await next()
  }

  if (!cancellation.source.token.throwIfRequested) {
    if (!production) {
      throw new Error('Missing cancellation function. Are you trying to use HttpClient via workers threads?')
    } else {
      return await next()
    }
  }

  const {onRequestFinish, cancelToken} = handleCancellation(ctx, cancellation)
  ctx.config.cancelToken = cancelToken

  try {
    await next()
  } finally {
    onRequestFinish()
  }
}
