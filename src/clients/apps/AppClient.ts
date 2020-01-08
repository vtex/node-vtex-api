import { AuthType, InstanceOptions } from '../../HttpClient/typings'
import { formatPrivateRoute } from '../../service/worker/runtime/http/routes'
import { IOContext } from '../../service/worker/runtime/typings'
import { IOClient } from '../IOClient'

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
      baseURL = formatPrivateRoute({account, workspace, vendor, name, major, protocol})
    } else {
      console.warn(`${account} in ${workspace} is using old routing for ${app}. Please change vendor.app to vendor.app@major in client ${(options && options.name) || ''}`)
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
