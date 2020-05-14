import { IOClients } from '../../../../../clients/IOClients'
import {
  LOCALE_HEADER,
  SEGMENT_HEADER,
  SESSION_HEADER,
  VaryHeaders,
} from '../../../../../constants'
import { ParamsContext, RecorderState, ServiceContext } from '../../typings'

interface CachingStrategy {
  forbidden: VaryHeaders[]
  path: string
  vary: VaryHeaders[]
}

const cachingStrategies: CachingStrategy[] = [
  {
    forbidden: [],
    path: '/_v/private/',
    vary: [SEGMENT_HEADER, SESSION_HEADER],
  },
  {
    forbidden: [SEGMENT_HEADER, SESSION_HEADER],
    path: '/_v/public/',
    vary: [],
  },
  {
    forbidden: [SESSION_HEADER],
    path: '/_v/segment/',
    vary: [SEGMENT_HEADER],
  },
]

const shouldVaryByHeader = <T extends IOClients, U, V>(
  ctx: ServiceContext<T, U, V>,
  header: VaryHeaders,
  strategy?: CachingStrategy
) => {
  if (strategy && strategy.vary.includes(header)) {
    return true
  }

  if (process.env.DETERMINISTIC_VARY) {
    return false
  }

  return !!ctx.get(header)
}


export async function vary <
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
> (ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
  const { method, path } = ctx
  const strategy = cachingStrategies.find((cachingStrategy) => path.indexOf(cachingStrategy.path) === 0)

  if (strategy) {
    strategy.forbidden.forEach((headerName) => {
      delete ctx.headers[headerName]
    })
  }


  // We don't need to vary non GET requests, since they are never cached
  if (method.toUpperCase() !== 'GET') {
    await next()
    return
  }

  ctx.vary(LOCALE_HEADER)
  if (shouldVaryByHeader(ctx, SEGMENT_HEADER, strategy)) {
    ctx.vary(SEGMENT_HEADER)
  }
  if (shouldVaryByHeader(ctx, SESSION_HEADER, strategy)) {
    ctx.vary(SESSION_HEADER)
  }

  await next()
}
