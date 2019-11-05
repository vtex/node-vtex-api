import { IOContext } from '../service/typings'

import { IOClient } from './IOClient'
import { AuthType, InstanceOptions } from './typings'

/**
 * Used to perform calls on apps you declared a dependency for in your manifest.
 */
export class AppClient extends IOClient {
  constructor(app: string, context: IOContext, options?: InstanceOptions) {
    const {account, workspace, region} = context
    const [appName, appVersion] = app.split('@')
    const [vendor, name] = appName.split('.') // vtex.messages
    let baseURL: string
    if (appVersion) {
      const [major] = appVersion.split('.')
      baseURL = `http://app.io.vtex.com/${vendor}.${name}/v${major}/${account}/${workspace}`
    } else {
      context.logger.warn(`${account} in ${workspace} is using old routing for ${app}`)
      const service = [name, vendor].join('.') // messages.vtex
      baseURL = `http://${service}.${region}.vtex.io/${account}/${workspace}`
    }

    super(
      context,
      {
        ...options,
        authType: AuthType.bearer,
        baseURL,
        name,
      }
    )
  }
}
