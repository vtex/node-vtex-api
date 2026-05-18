import { InstanceOptions } from '../../HttpClient/typings'
import { IOContext } from '../../service/worker/runtime/typings'
import { ExternalClient } from '../external/ExternalClient'

type Environment = 'stable' | 'beta'

/**
 * Used to perform calls on APIs in the VTEX Janus infrastructure, to which you must declare an outbound policy.
 *
 * Example policy:
 *
 * {
 *   "name": "outbound-access",
 *   "attrs": {
 *     "host": "portal.vtexcommercestable.com.br",
 *     "path": "/api/*"
 *   }
 * }
 */
export class JanusClient extends ExternalClient {
  constructor(
    context: IOContext,
    options?: InstanceOptions,
    environment?: Environment
  ) {
    const { account } = context
    const env =
      context.janusEnv === 'beta' || environment === 'beta' ? 'beta' : 'stable'

    super(`http://portal.vtexcommerce${env}.com.br`, context, {
      ...options,
      params: {
        an: account,
        ...options?.params,
      },
    })
  }
}
