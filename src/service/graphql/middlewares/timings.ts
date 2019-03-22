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
    metrics.batchMetric(`graphql-resolver-${pathName}`, nanoToMillis(resolver.duration))
  })
}

const batchGraphQLHrTimeMetric = (query: any, start: any) => {
  if (query && query.query) {
    metrics.batch(query.query, process.hrtime(start))
  }
}

export const timings = async (ctx: GraphQLServiceContext, next: () => Promise<void>) => {
  const {graphql: {query, graphqlResponse}} = ctx

  const startGraphQL = process.hrtime()
  await next()
  batchGraphQLHrTimeMetric(query, startGraphQL)

  const resolverTimings = path(['extensions', 'tracing', 'execution', 'resolvers'], graphqlResponse!) as ResolverTracing[]
  batchResolversTracing(resolverTimings)
}
