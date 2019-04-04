import { any, path, propEq } from 'ramda'

import { GraphQLServiceContext } from '../typings'
import { generatePathName } from '../utils/pathname'

interface ResolverTracing {
  duration: number,
  fieldName: string,
  parentType: string,
  path: [string | number],
  returnType: string,
  startOffset: number,
}

const nanoToMillis = (nanoseconds: number) => Math.round((nanoseconds / 1e6))

const hasErrorForPathName = (pathName: string, graphqlErrors?: any[]) => {
  return graphqlErrors && any(propEq('pathName', pathName), graphqlErrors) || false
}

const batchResolversTracing = (resolvers: ResolverTracing[], graphqlErrors?: any[]) => {
  resolvers.forEach(resolver => {
    const pathName = generatePathName(resolver.path)
    const status = hasErrorForPathName(pathName, graphqlErrors)
      ? 'error'
      : 'success'
    const extensions = {
      fieldName: resolver.fieldName,
      parentType: resolver.parentType,
      pathName,
      returnType: resolver.returnType,
    }
    metrics.batchMetric(`graphql-resolver-${status}-${pathName}`, nanoToMillis(resolver.duration), extensions)
  })
}

export const timings = async (ctx: GraphQLServiceContext, next: () => Promise<void>) => {
  const start = process.hrtime()

  // Errors will be caught by the next middleware so we don't have to catch.
  await next()

  // Batch success or error metric for entire operation
  metrics.batch(`graphql-operation-${ctx.graphql.status}`, process.hrtime(start))

  // Batch timings for individual resolvers
  const resolverTimings = path<ResolverTracing[] | undefined>(['extensions', 'tracing', 'execution', 'resolvers'], ctx.graphql.graphqlResponse!)
  if (resolverTimings) {
    batchResolversTracing(resolverTimings, ctx.graphql.graphqlErrors)
  }
}
