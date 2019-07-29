import { GraphQLServiceContext } from '../typings'

import { cachingStrategies } from '../../utils/cachingStrategies'
import { canAddVary } from '../../utils/canAddVary'

export async function vary (ctx: GraphQLServiceContext, next: () => Promise<any>) {
  if (ctx.graphql.cacheScope && canAddVary(ctx)) {
    const strategy = cachingStrategies.find(cachingStrategy => cachingStrategy.name === ctx.graphql.cacheScope)
    if (strategy) {
      strategy.vary.forEach((varyHeader) => {
        ctx.vary(varyHeader)
      })
    }
  }

  await next()
}
