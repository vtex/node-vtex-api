import { IOClients } from '../../../clients/IOClients'
import { SEGMENT_HEADER, SESSION_HEADER } from '../../../constants'
import { ServiceContext } from '../../typings'
import { cachingStrategies } from '../../utils/cachingStrategies'
import { canAddVary } from '../../utils/canAddVary'

export async function vary <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const { method, path } = ctx
  const strategy = cachingStrategies.find(strat => strat.regex.test(path))

  if (strategy) {
    strategy.forbidden.forEach(headerName => {
      delete ctx.headers[headerName]
    })
  }

  // We don't need to vary non GET requests, since they are never cached
  if (method.toUpperCase() !== 'GET') {
    await next()
    return
  }

  if (strategy) {
    strategy.vary.forEach((varyHeader) => {
      ctx.vary(varyHeader)
    })
  }

  await next()

  // Fallback
  if (!strategy && canAddVary(ctx)) {
    if (ctx.get(SEGMENT_HEADER)) {
      ctx.vary(SEGMENT_HEADER)
    }
    if (ctx.get(SESSION_HEADER)) {
      ctx.vary(SESSION_HEADER)
    }
  }

}
