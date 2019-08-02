import { IOContext } from '../service/typings'

import { IOClient } from './IOClient'
import { InstanceOptions } from './typings'

/**
 * Used to perform calls to external endpoints for which you have declared outbound access policies in your manifest.
 */
export class ExternalClient extends IOClient {
  public constructor(
    baseURL: string,
    context: IOContext,
    options?: InstanceOptions
  ) {
    const { authToken } = context
    const headers = (options && options.headers) || {}

    super(context, {
      ...options,
      baseURL,
      headers: {
        ...headers,
        'Proxy-Authorization': authToken,
      },
    })
  }
}
