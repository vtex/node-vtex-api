import { IOClients } from '../../../../../clients/IOClients'
import {
  HeaderKeys,
  VaryHeaders
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
    vary: [HeaderKeys.SEGMENT, HeaderKeys.SESSION],
  },
  {
    forbidden: [HeaderKeys.SEGMENT, HeaderKeys.SESSION],
    path: '/_v/public/',
    vary: [],
  },
  {
    forbidden: [HeaderKeys.SESSION],
    path: '/_v/segment/',
    vary: [HeaderKeys.SEGMENT],
  },
]

const shouldVaryByHeader = <T extends IOClients, U extends RecorderState, V extends ParamsContext>(
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

  ctx.vary(HeaderKeys.LOCALE)

  if (shouldVaryByHeader(ctx, HeaderKeys.SEGMENT, strategy)) {
    ctx.vary(HeaderKeys.SEGMENT)
  }

  if (shouldVaryByHeader(ctx, HeaderKeys.SESSION, strategy)) {
    ctx.vary(HeaderKeys.SESSION)
  }

  await next()
}
