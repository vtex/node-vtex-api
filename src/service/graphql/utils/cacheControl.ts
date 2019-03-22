import { CacheControlFormat, CacheScope } from 'apollo-cache-control'
import { GraphQLResponse } from 'graphql-extensions'
import { any, compose, equals, isNil, min, path, pluck as rPluck, reduce, reject, replace, test } from 'ramda'

import { GraphQLServiceContext } from '../typings'
import { maxAgeEnums } from '../utils/maxAgeEnum'

type CacheControlHintsFormat = CacheControlFormat['hints']

type MaybeNumber = number | null

type MaybeCacheScope = CacheScope | null

const pluck = <K extends string, T> (p: K) => (list: ReadonlyArray<T>) => rPluck(p, list)

const VTEX_PUBLIC_ENDPOINT = process.env.VTEX_PUBLIC_ENDPOINT || ''

const pickCacheControlHints = (response: GraphQLResponse) => path<CacheControlHintsFormat>(
  ['extensions', 'cacheControl', 'hints'],
  response
)

const minArray = (nums: number[]): number => reduce<number, number>(min, maxAgeEnums.LONG, nums)

const minMaxAge = (hints: CacheControlHintsFormat): number => compose<CacheControlHintsFormat, MaybeNumber[], number[], number>(
  minArray,
  reject(isNil),
  pluck('maxAge')
)(hints)

const anyPrivate = (hints: CacheControlHintsFormat): boolean => compose<CacheControlHintsFormat, MaybeCacheScope[], boolean>(
  any(equals('PRIVATE')) as any,
  pluck('scope')
)(hints)

const anySegment = (hints: CacheControlHintsFormat): boolean => compose<CacheControlHintsFormat, MaybeCacheScope[], boolean>(
  any(equals('SEGMENT')) as any,
  pluck('scope')
)(hints)

const isPrivateRoute = ({request: {headers}}: GraphQLServiceContext) => test(/_v\/graphql\/private\/v*/, headers['x-forwarded-path'] || '')

const publicRegExp = compose(
  (exp: string) => new RegExp(exp),
  (exp: string) => `.*${exp}.*`,
  replace('.', '\\.')
)(VTEX_PUBLIC_ENDPOINT)

const isPublicEndpoint = ({request: {headers}}: GraphQLServiceContext) => headers.origin
  ? false
  : test(publicRegExp, headers['x-forwarded-host'] || '')

export const cacheControl = (response: GraphQLResponse, ctx: GraphQLServiceContext) => {
  const {vtex: {production}} = ctx
  const hints = response && pickCacheControlHints(response)
  const age = hints && minMaxAge(hints)
  const isPrivate = hints && anyPrivate(hints)
  const segment = hints && anySegment(hints)
  return {
    maxAge: (age === 0 || isPublicEndpoint(ctx) || !production) ? 'no-cache, no-store' : `max-age=${age}`,
    scope: (isPrivate || isPrivateRoute(ctx)) ? 'private' : 'public',
    segment,
  }
}
