import { statusTrackHandler } from '../statusTrack'
import { ServiceContext } from '../typings'

describe('statusTrackHandler', () => {
  // /_status is served by a handler that answers 200, so its samples must carry a
  // handler label like every other builtin (healthcheck, whoami, metrics-logger)
  // instead of landing in the catch-all `handler="undefined"` bucket.
  it('names the request so metrics are not reported as unnamed', async () => {
    const setOperationName = jest.fn()
    const ctx: any = {
      body: undefined,
      tracing: { currentSpan: { setOperationName } },
    }

    await statusTrackHandler(ctx as ServiceContext)

    expect(ctx.requestHandlerName).toBe('builtin:status-track')
    expect(setOperationName).toHaveBeenCalledWith('builtin:status-track')
    expect(ctx.body).toEqual([])
  })

  it('works when tracing is disabled for the path', async () => {
    const ctx: any = { body: undefined, tracing: undefined }

    await statusTrackHandler(ctx as ServiceContext)

    expect(ctx.requestHandlerName).toBe('builtin:status-track')
  })
})
