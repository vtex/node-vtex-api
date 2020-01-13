import { USE_FAST_RECORDER } from '../../constants'
import { MiddlewareContext } from '../typings'
import {
  Recorder,
  SlowRecorder,
} from './../../service/worker/runtime/utils/recorder'

export const recorderMiddleware = (recorder: Recorder | SlowRecorder) => USE_FAST_RECORDER
  ? async (ctx: MiddlewareContext, next: () => Promise<void>) => {
      try {
        await next()
        if (ctx.response) {
          (recorder as Recorder).record(ctx.response.headers)
        }
      } catch (err) {
        if (err.response && err.response.headers && err.response.status === 404) {
          (recorder as Recorder).record(err.response.headers)
        }
        throw err
      }
    }
  : async (ctx: MiddlewareContext, next: () => Promise<void>) => {
      try {
        await next()
        if (ctx.response) {
          (recorder as SlowRecorder)(ctx.response.headers)
        }
      } catch (err) {
        if (err.response && err.response.headers && err.response.status === 404) {
          (recorder as SlowRecorder)(err.response.headers)
        }
        throw err
      }
    }
