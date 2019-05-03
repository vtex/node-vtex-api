import { IOContext } from '../../service/typings'

import { HttpClient } from '../HttpClient'
import { AuthType, InstanceOptions } from '../typings'

export const rootURL = (
  service: string,
  { region }: IOContext,
  { baseURL }: InstanceOptions
): string => {
  if (baseURL) {
    return 'http://' + baseURL
  }

  if (region) {
    return `http://${service}.${region}.vtex.io`
  }

  throw new Error('Missing required: should specify either {region} or {baseURL}')
}

export const workspaceURL = (
  service: string,
  context: IOContext,
  opts: InstanceOptions
): string => {
  const { account, workspace } = context
  if (!account || !workspace) {
    throw new Error('Missing required arguments: {account, workspace}')
  }

  return rootURL(service, context, opts) + `/${account}/${workspace}`
}

export const forWorkspace = (
  service: string,
  context: IOContext,
  opts: InstanceOptions
): HttpClient => {
  const baseURL = workspaceURL(service, context, opts)
  return new HttpClient({
    ...context,
    ...opts,
    authType: AuthType.bearer,
    baseURL,
  })
}

export const forRoot = (service: string, context: IOContext, opts: InstanceOptions): HttpClient => {
  const baseURL = rootURL(service, context, opts)
  return new HttpClient({
    ...context,
    ...opts,
    authType: AuthType.bearer,
    baseURL,
  })
}

export const forExternal = (
  baseURL: string,
  context: IOContext,
  opts: InstanceOptions
): HttpClient => {
  return new HttpClient({
    ...context,
    ...opts,
    baseURL,
  })
}
