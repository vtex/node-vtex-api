import { IOContext } from '../service/typings'

import { IOClient } from './IOClient'
import { AuthType, InstanceOptions } from './typings'
import { REGION_HEADER } from '../constants'

const useHttps = !process.env.VTEX_IO

/**
 * Used to perform calls on apps you declared a dependency for in your manifest.
 */
export class AppClient extends IOClient {
  constructor(app: string, context: IOContext, options?: InstanceOptions) {
    const {account, workspace, region} = context
    const [appName, appVersion] = app.split('@')
    const [vendor, name] = appName.split('.') // vtex.messages
    const protocol = useHttps ? 'https' : 'http'
    let baseURL: string
    if (appVersion) {
      const [major] = appVersion.split('.')
      baseURL = `${protocol}://app.io.vtex.com/${vendor}.${name}/v${major}/${account}/${workspace}`
    } else {
      console.warn(`${account} in ${workspace} is using old routing for ${app}. Please change vendor.app to vendor.app@major in client ${(options && options.name) || ''}`)
      const service = [name, vendor].join('.') // messages.vtex
      baseURL = `http://${service}.${region}.vtex.io/${account}/${workspace}`
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
        name,
      }
    )
  }
}
