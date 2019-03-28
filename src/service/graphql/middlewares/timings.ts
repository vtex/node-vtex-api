import { filter, path } from 'ramda'

import { GraphQLServiceContext } from '../typings'

interface ResolverTracing {
  duration: number,
  fieldName: string,
  parentType: string,
  path: [string | number],
  returnType: string,
  startOffset: number,
}

const nanoToMillis = (nanoseconds: number) => Math.round((nanoseconds / 1e6))

const generatePathName = (rpath: [string | number]) => {
  const pathFieldNames = filter(value => typeof value === 'string', rpath)
  return pathFieldNames.join('.')
}

const batchResolversTracing = (resolvers: ResolverTracing[]) => {
  resolvers.forEach(resolver => {
    const pathName = generatePathName(resolver.path)
    const extensions = {
      fieldName: resolver.fieldName,
      parentType: resolver.parentType,
      pathName,
      returnType: resolver.returnType,
    }
    metrics.batchMetric(`graphql-resolver-${pathName}`, nanoToMillis(resolver.duration), extensions)
  })
}

export const timings = async (ctx: GraphQLServiceContext, next: () => Promise<void>) => {
  const start = process.hrtime()

  // Errors will be caught by the next middleware so we don't have to catch.
  await next()

  // Batch success or error metric for entire operation
  metrics.batch(`graphql-operation`, process.hrtime(start), { [ctx.graphql.status as string]: 1 })

  // Batch timings for individual resolvers
  const resolverTimings = path(['extensions', 'tracing', 'execution', 'resolvers'], ctx.graphql.graphqlResponse!) as ResolverTracing[]
  batchResolversTracing(resolverTimings)
}
