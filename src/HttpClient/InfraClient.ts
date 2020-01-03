import { IOContext } from '../service/typings'

import { IOClient } from './IOClient'
import { AuthType, InstanceOptions } from './typings'
import { REGION_HEADER } from '../constants'

const useHttps = !process.env.VTEX_IO
/**
 * Used to perform calls on infra apps (e.g. sphinx, apps, vbase).
 */
export class InfraClient extends IOClient {
  constructor(app: string, context: IOContext, options?: InstanceOptions, isRoot: boolean = false) {
    const {account, workspace, region} = context
    const [appName, appVersion] = app.split('@')
    const protocol = useHttps ? 'https' : 'http'
    let baseURL: string
    if (appVersion) {
      const [appMajor] = appVersion.split('.')
      baseURL = `${protocol}://infra.io.vtex.com/${appName}/v${appMajor}${isRoot ? '' : `/${account}/${workspace}`}`
    } else if (app === 'router') {
      baseURL = `${protocol}://platform.io.vtex.com/${isRoot ? '' : `/${account}/${workspace}`}`
    } else {
      console.warn(`${account} in ${workspace} is using old routing for ${app}. This will stop working soon`)
      baseURL = `http://${app}.${region}.vtex.io${isRoot ? '' : `/${account}/${workspace}`}`
    }

    super(
      context,
      {
        ...options,
        headers: {
          ... options?.headers,
          ... region ? { [REGION_HEADER]: region } : null,
        },
        authType: AuthType.bearer,
        baseURL,
      }
    )
  }
}

