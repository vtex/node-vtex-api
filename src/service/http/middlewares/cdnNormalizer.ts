import { IOClients } from '../../../clients/IOClients'
import { SEGMENT_HEADER, SESSION_HEADER, VaryHeaders } from '../../../constants'
import { ServiceContext } from '../../typings'

export interface CachingStrategy {
  forbidden: VaryHeaders[]
  path: string
  vary: VaryHeaders[]
}

export const cachingStrategies: CachingStrategy[] = [
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
    path: '/_v/segment.',
    vary: [SEGMENT_HEADER],
  },
]


export async function cdnNormalizer <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const { path } = ctx
  const strategy = cachingStrategies.find(cachingStrategy => path.indexOf(cachingStrategy.path) === 0)

  if (strategy) {
    strategy.forbidden.forEach(headerName => {
      delete ctx.headers[headerName]
    })
  }

  await next()
}
