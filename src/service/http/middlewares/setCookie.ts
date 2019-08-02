import { compose, find, head, isEmpty, map, split } from 'ramda'

import { IOClients } from '../../../clients/IOClients'
import { ServiceContext } from '../../typings'

const BLACKLISTED_COOKIES = new Set<string>(['checkout.vtex.com'])

const warnMessage = (keys: string[]) => `Removing set-cookie from response since cache-control has as public scope.
This can be a huge security risk. Please remove either the public scope or set-cookie from your response.
Cookies dropped:

  ${keys.join('\n\t')}
`

const findStr = (target: string, set: string[]) => find((a: string) => a.toLocaleLowerCase() === target, set)

const findScopeInCacheControl = (cacheControl: string | undefined) => {
  const splitted = cacheControl && cacheControl.split(/\s*,\s*/g)
  const scopePublic = splitted && findStr('public', splitted)
  return scopePublic
}

const cookieKey = (cookie: string) => compose<string, string[], string>(head, split('='))(cookie)

const indexCookieByKeys = (setCookie: string[]) => map(
  (cookie: string) => [cookieKey(cookie), cookie] as [string, string],
  setCookie
)

interface CookieAccumulator {
  addedPayload: string[]
  droppedKeys: string[]
}

export async function removeSetCookie<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const { clients: { logger } } = ctx

  await next()

  const setCookie: string[] | undefined = ctx.response.headers['set-cookie']
  if (!setCookie || isEmpty(setCookie)) {
    return
  }

  const cacheControl: string | undefined = ctx.response.headers['cache-control']
  const scope = findScopeInCacheControl(cacheControl)
  if (scope === 'public') {
    const indexedCookies = indexCookieByKeys(setCookie)
    const cookies = indexedCookies.reduce<CookieAccumulator>(
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
      }
    )

    if (cookies.droppedKeys.length > 0) {
      ctx.set('set-cookie', cookies.addedPayload)
      console.warn(warnMessage(cookies.droppedKeys))
      logger.warn({
        cookieKeys: cookies.droppedKeys,
        message: 'Setting cookies in a public route!',
      }).catch()
    }
  }
}
