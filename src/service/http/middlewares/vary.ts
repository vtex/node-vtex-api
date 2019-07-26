import { IOClients } from '../../../clients/IOClients'
import { SEGMENT_HEADER, SESSION_HEADER } from '../../../constants'
import { GraphQLContext } from '../../graphql/typings'
import { ServiceContext } from '../../typings'

const cachingStrategies = [
  {
    forbidden: [],
    name: 'private',
    regex: /^\/_v\/private\//,
    vary: [SEGMENT_HEADER, SESSION_HEADER],
  },
  {
    forbidden: [SEGMENT_HEADER, SESSION_HEADER],
    name: 'public',
    regex: /^\/_v\/public\//,
    vary: [],
  },
  {
    forbidden: [SESSION_HEADER],
    name: 'segment',
    regex: /^\/_v\/segment\//,
    vary: [SEGMENT_HEADER],
  },
]

const graphqlRouteRegex = /\/_v\/graphql$/

function isGraphqlContext <T extends IOClients, U, V> (ctx: ServiceContext<T,U,V>): ctx is ServiceContext<T,U,V> & Pick<GraphQLContext, 'graphql'> {
  if ('graphql' in ctx) {
    return true
  }
  return false
}

function setVaryIfExists<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, varyHeaders: string[]) {
  varyHeaders.forEach((varyHeader) => {
    if (ctx.get(varyHeader)) {
      ctx.vary(varyHeader)
    }
  })
}

export async function vary <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const { method, path } = ctx
  let strategy = cachingStrategies.find(strat => strat.regex.test(path))

  const isGraphql = graphqlRouteRegex.test(path)

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
    setVaryIfExists(ctx, strategy.vary)
  } else if (!isGraphql) {
    if (ctx.get(SEGMENT_HEADER)) {
      ctx.vary(SEGMENT_HEADER)
    }
    if (ctx.get(SESSION_HEADER)) {
      ctx.vary(SESSION_HEADER)
    }
  }

  await next()

  if (isGraphql && isGraphqlContext(ctx)) {
    strategy = cachingStrategies.find(cachingStrategy => cachingStrategy.name === ctx.graphql.cacheScope)
    if (strategy) {
      setVaryIfExists(ctx, strategy.vary)
    }
  }
}
