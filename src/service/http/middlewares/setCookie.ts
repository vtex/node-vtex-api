import { compose, find, forEach, head, intersection, isEmpty, map, split } from 'ramda'

import { IOClients } from '../../../clients/IOClients'
import { ServiceContext } from '../../typings'

const BLACKLISTED_COOKIES = ['checkout.vtex.com']

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

const extractKeys = (setCookie: string[]) => map<string, string>(compose(head, split('=')), setCookie)

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
    const cookieKeys = extractKeys(setCookie)
    const blacklist = intersection(BLACKLISTED_COOKIES, cookieKeys)
    forEach<string, string[]>(cookie => ctx.cookies.set(cookie, undefined), blacklist)
    console.warn(warnMessage(blacklist))
    logger.warn({
      cookieKeys,
      message: 'Setting cookies in a public route!',
    }).catch()
  }
}
