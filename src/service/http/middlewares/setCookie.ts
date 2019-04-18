import { find } from 'ramda'

import { IOClients } from '../../../clients/IOClients'
import { ServiceContext } from '../../typings'

const warnMessage = `Removing set-cookie from response since cache-control has as public scope.
This can be a huge security risk. Please remove either the public scope or set-cookie from your response.`

const findStr = (target: string, set: string[]) => find((a: string) => a.toLocaleLowerCase() === target, set)

const findScopeInCacheControl = (cacheControl: string | undefined) => {
  const splitted = cacheControl && cacheControl.split(/\s*,\s*/g)
  const scopePublic = splitted && findStr('public', splitted)
  return scopePublic
}

export async function removeSetCookie<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  await next()

  const setCookie = ctx.response.headers['set-cookie']
  if (!setCookie) {
    return
  }

  const cacheControl = ctx.response.headers['cache-control']
  const scope = findScopeInCacheControl(cacheControl)
  if (scope === 'public') {
    ctx.set('Set-Cookie', '')
    console.warn(warnMessage)
  }
}
