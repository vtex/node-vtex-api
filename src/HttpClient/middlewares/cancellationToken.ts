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
  } else if (cancellation.source) {
    if (!cancellation.source.token.throwIfRequested && !production) {
      throw new Error('Missing cancellation function. Are you trying to use HttpClient via workers threads?')
    } else {
      ctx.config.cancelToken = cancellation.source.token
    }
  }

  await next()
}

export const cancellationPromise = async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  const {config: {cancelToken}} = ctx
  if (!cancelToken) {
    return await next()
  }

  let responsePending = true
  const cancelPromise = cancelToken.promise
  cancelToken.promise = new Promise((resolve, reject) => {
    cancelPromise.then(cancel => {
      if (responsePending) {
        resolve(cancel)
      }
    }).catch(err => {
      if (responsePending) {
        reject(err)
      }
    })
  })

  try {
    await next()
  } finally {
    if (ctx.response && ctx.config.responseType === 'stream') {
      ctx.response.data.on('end', function streamEnded() {
        responsePending = false
      })
    } else {
      responsePending = false
    }
  }
}
