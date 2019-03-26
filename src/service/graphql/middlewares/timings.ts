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
  const {graphql: {graphqlResponse}} = ctx
  await next()
  const resolverTimings = path(['extensions', 'tracing', 'execution', 'resolvers'], graphqlResponse!) as ResolverTracing[]
  batchResolversTracing(resolverTimings)
}
