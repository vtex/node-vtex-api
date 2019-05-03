import { MiddlewareContext } from '../typings'

export const recorderMiddleware = (recorder: Recorder) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    try {
      await next()
      if (ctx.response) {
        recorder(ctx.response.headers)
      }
    } catch (err) {
      if (err.response && err.response.headers && err.response.status === 404) {
        recorder(err.response.headers)
      }
      throw err
    }
  }
}

export type Recorder = (headers: any) => void
