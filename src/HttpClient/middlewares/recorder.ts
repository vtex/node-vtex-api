import { AxiosError } from 'axios'
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
        (recorder as Recorder).record(ctx.response.headers as any)
      }
    } catch (err) {
      if (!(err instanceof AxiosError)) {
        throw err
      }
      
      if (err.response && err.response.headers && err.response.status === 404) {
        (recorder as Recorder).record(err.response.headers as any)
      }
      throw err
    }
  }
