import { IOContext } from '../service/typings'

import { ExternalClient } from './ExternalClient'
import { InstanceOptions } from './typings'

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
  constructor(context: IOContext, options?: InstanceOptions) {
    const {account} = context

    if (context.janusEnv) {
      options = options || {}
      options = {
        ...options,
        headers: {
          ...options.headers,
          'cookie': context.janusEnv,
        },
      }
    }

    super(
      'http://portal.vtexcommercestable.com.br',
      context,
      {
        ...options,
        params: {
          an: account,
        },
      }
    )
  }
}
