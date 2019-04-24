import { IOContext } from '../service/typings'

import { IOClient } from './IOClient'
import { AuthType, InstanceOptions } from './typings'

/**
 * Used to perform calls on infra apps (e.g. sphinx, apps, vbase).
 */
export class InfraClient extends IOClient {
  constructor(app: string, context: IOContext, options: InstanceOptions, isRoot: boolean = false) {
    const {account, workspace, region} = context
    const baseURL = `http://${app}.${region}.vtex.io${isRoot ? '' : `/${account}/${workspace}`}`

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
