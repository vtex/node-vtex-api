import { IOContext } from '../service/typings'
import { IOGraphQLClient } from './IOGraphQLClient'
import { AuthType, InstanceOptions } from './typings'

/**
 * Used to perform calls on apps you declared a dependency for in your manifest.
 */
export class AppGraphQLClient extends IOGraphQLClient {
  public constructor(
    app: string,
    context: IOContext,
    options?: InstanceOptions
  ) {
    const { account, workspace, region } = context
    const [vendor, name] = app.split('.') // vtex.messages
    const service = [name, vendor].join('.') // messages.vtex
    const baseURL = `http://${service}.${region}.vtex.io/${account}/${workspace}/_v/graphql`

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
