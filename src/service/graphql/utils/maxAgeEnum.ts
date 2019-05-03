import { path } from 'ramda'

import { GraphQLServiceContext } from '../typings'

/*
 * This file contains the enumeration -> int map for generating the max age
 * in the graphql cacheControl
 */
export const maxAgeEnums = {
  LONG: 86400,
  MEDIUM: 3600,
  SHORT: 120,
}

export const defaultMaxAgeFromCtx = (ctx: GraphQLServiceContext) => {
  const forwarded = path<string>(['request', 'header', 'x-forwarded-path'], ctx)
  const isPrivateRoute = forwarded && /_v\/graphql\/private\/v*/.test(forwarded)
  return isPrivateRoute ? 0 : maxAgeEnums.LONG
}
