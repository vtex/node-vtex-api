import { MiddlewareContext } from '../typings'
import {
  Recorder,
} from './../../service/worker/runtime/utils/recorder'

export const recorderMiddleware = (recorder: Recorder) =>
  async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    if (ctx.config?.ignoreRecorder) {
      await next()
      return
    }

    try {
      await next()
      if (ctx.response) {
        (recorder as Recorder).record(ctx.response.headers)
      }
    } catch (err: any) {
      if (err.response && err.response.headers && err.response.status === 404) {
        (recorder as Recorder).record(err.response.headers)
      }
      throw err
    }
  }
