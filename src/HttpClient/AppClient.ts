import { BaseIOContext } from '../service/typings'

import { IOClient } from './IOClient'
import { AuthType, InstanceOptions } from './typings'

/**
 * Used to perform calls on apps you declared a dependency for in your manifest.
 */
export class AppClient extends IOClient {
  constructor(app: string, context: BaseIOContext, options?: InstanceOptions) {
    const {account, workspace, region} = context
    const [vendor, name] = app.split('.') // vtex.messages
    const service = [name, vendor].join('.') // messages.vtex
    const baseURL = `http://${service}.${region}.vtex.io/${account}/${workspace}`

    super(
      context,
      {
        ...options,
        authType: AuthType.bearer,
        baseURL,
      }
    )
  }
}
