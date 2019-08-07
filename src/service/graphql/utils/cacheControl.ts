import { CacheControlFormat, CacheScope } from 'apollo-cache-control'
import { GraphQLResponse } from 'graphql-extensions'
import {
  any,
  compose,
  equals,
  isNil,
  min,
  path,
  pluck as rPluck,
  reduce,
  reject,
  replace,
  test,
} from 'ramda'

import { GraphQLServiceContext } from '../typings'
import { maxAgeEnums } from '../utils/maxAgeEnum'

type CacheControlHintsFormat = CacheControlFormat['hints']

type MaybeNumber = number | null

type MaybeCacheScope = CacheScope | null

const linked = !!process.env.VTEX_APP_LINK

const pluck = <K extends string, T>(p: K) => (list: ReadonlyArray<T>) =>
  rPluck(p, list)

const publicRegExp = compose(
  (exp: string) => new RegExp(exp),
  (exp: string) => `.*${exp}.*`,
  replace('.', '\\.')
)

const VTEX_PUBLIC_ENDPOINT = process.env.VTEX_PUBLIC_ENDPOINT || ''
const GOCOMMERCE_PUBLIC_ENDPOINT = 'mygocommerce.com'

const GOCOMMERCE_REGEXP = publicRegExp(GOCOMMERCE_PUBLIC_ENDPOINT)
const VTEX_REGEXP = publicRegExp(VTEX_PUBLIC_ENDPOINT)

const pickCacheControlHints = (response: GraphQLResponse) =>
  path<CacheControlHintsFormat>(
    ['extensions', 'cacheControl', 'hints'],
    response
  )

const minArray = (nums: number[]): number =>
  reduce<number, number>(min, maxAgeEnums.LONG, nums)

const minMaxAge = (hints: CacheControlHintsFormat): number =>
  compose<CacheControlHintsFormat, MaybeNumber[], number[], number>(
    minArray,
    reject(isNil),
    pluck('maxAge')
  )(hints)

const anyPrivate = (hints: CacheControlHintsFormat): boolean =>
  compose<CacheControlHintsFormat, MaybeCacheScope[], boolean>(
    any(equals('PRIVATE')) as any,
    pluck('scope')
  )(hints)

const anySegment = (hints: CacheControlHintsFormat): boolean =>
  compose<CacheControlHintsFormat, MaybeCacheScope[], boolean>(
    any(equals('SEGMENT')) as any,
    pluck('scope')
  )(hints)

const isPrivateRoute = ({ request: { headers } }: GraphQLServiceContext) =>
  test(/_v\/graphql\/private\/v*/, headers['x-forwarded-path'] || '')

const isPublicEndpoint = ({ request: { headers } }: GraphQLServiceContext) => {
  if (headers.origin) {
    return false
  }

  const host = headers['x-forwarded-host'] || ''
  return test(VTEX_REGEXP, host) || test(GOCOMMERCE_REGEXP, host)
}

export const cacheControl = (
  response: GraphQLResponse,
  ctx: GraphQLServiceContext
) => {
  const {
    vtex: { production },
  } = ctx
  const hints = response && pickCacheControlHints(response)
  const age = hints && minMaxAge(hints)
  const isPrivate = hints && anyPrivate(hints)
  const segment = hints && anySegment(hints)

  const maxAge = linked
    ? 'no-store'
    : isPublicEndpoint(ctx) || !production
    ? 'no-cache'
    : `max-age=${age}`

  return {
    maxAge,
    scope: isPrivate || isPrivateRoute(ctx) ? 'private' : 'public',
    segment,
  }
}
