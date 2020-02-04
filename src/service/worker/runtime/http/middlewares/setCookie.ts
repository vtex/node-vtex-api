import { isEmpty } from 'ramda'

import { IOClients } from '../../../../../clients/IOClients'
import { ParamsContext, RecorderState, ServiceContext } from '../../typings'

const BLACKLISTED_COOKIES = new Set<string>(['checkout.vtex.com'])

const warnMessage = (keys: string[]) => `Removing set-cookie from response since cache-control has as public scope.
This can be a huge security risk. Please remove either the public scope or set-cookie from your response.
Cookies dropped:

  ${keys.join('\n\t')}
`

const PUBLIC = 'public'

const findScopeInCacheControl = (cacheControl: string | undefined) => {
  const splitted = cacheControl?.split(/\s*,\s*/g)
  const scopePublic = splitted?.find(a => a.toLowerCase() === PUBLIC)
  return scopePublic
}

const cookieKey = (cookie: string) => cookie.split('=')[0]

const indexCookieByKeys = (setCookie: string[]) => setCookie.map(
  cookie => [cookieKey(cookie), cookie] as [string, string]
)

interface CookieAccumulator {
  addedPayload: string[]
  droppedKeys: string[]
}

export async function removeSetCookie<
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
> (ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
  const { vtex: { logger } } = ctx

  await next()

  const setCookie: string[] | undefined = ctx.response.headers['set-cookie']
  if (!setCookie || isEmpty(setCookie)) {
    return
  }

  const cacheControl: string | undefined = ctx.response.headers['cache-control']
  const scope = findScopeInCacheControl(cacheControl)
  if (scope === PUBLIC) {
    const indexedCookies = indexCookieByKeys(setCookie)
    const cookies = indexedCookies.reduce(
      (acc, [key, payload]) => {
        if (BLACKLISTED_COOKIES.has(key)) {
          acc.droppedKeys.push(key)
        } else {
          acc.addedPayload.push(payload)
        }
        return acc
      },
      {
        addedPayload: [],
        droppedKeys: [],
      } as CookieAccumulator
    )

    if (cookies.droppedKeys.length > 0) {
      ctx.set('set-cookie', cookies.addedPayload)
      console.warn(warnMessage(cookies.droppedKeys))
      logger!.warn({
        cookieKeys: cookies.droppedKeys,
        message: 'Setting cookies in a public route!',
      })
    }
  }
}
