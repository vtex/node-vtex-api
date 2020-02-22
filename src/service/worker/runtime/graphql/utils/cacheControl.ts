import { PUBLIC_DOMAINS } from '../../../../../utils/domain'
import { GraphQLServiceContext } from '../typings'

const PRIVATE_ROUTE_REGEX = /_v\/graphql\/private\/v*/

const linked = !!process.env.VTEX_APP_LINK

const isPrivateRoute = ({ request: { headers } }: GraphQLServiceContext) =>
  PRIVATE_ROUTE_REGEX.test(headers['x-forwarded-path'] || '')

const publicRegExp = (endpoint: string) => new RegExp(`.*${endpoint.replace('.', '\\.')}.*`)

const isPublicEndpoint = ({ request: { headers } }: GraphQLServiceContext) => {
  const host = headers['x-forwarded-host']

  if (headers.origin || !host) {
    return false
  }

  return PUBLIC_DOMAINS.some(endpoint => publicRegExp(endpoint).test(host))
}

export const cacheControlHTTP = (ctx: GraphQLServiceContext) => {
  const {
    graphql: {
      cacheControl: { maxAge, scope: scopeHint, noCache: noCacheHint, noStore: noStoreHint },
    },
    vtex: { production },
  } = ctx

  const finalHeader = []

  const noCache = noCacheHint || !production || isPublicEndpoint(ctx)
  if (noCache) {
    finalHeader.push('no-cache')
  }

  const noStore = noStoreHint || linked
  if (noStore) {
    finalHeader.push('no-store')
  }

  if (!noCache && !noStore) {
    const scope = scopeHint === 'private' || isPrivateRoute(ctx) ? 'private' : 'public'
    finalHeader.push(scope)

    finalHeader.push(`max-age=${maxAge}`)
  }

  return finalHeader.join(',')
}
