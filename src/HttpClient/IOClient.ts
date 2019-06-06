import { BaseIOContext } from '../service/typings'

import { HttpClient } from './HttpClient'
import { InstanceOptions } from './typings'

export type IOClientConstructor = new (context: BaseIOContext, options?: InstanceOptions) => IOClient

/**
 * A client that can be instantiated by the Service runtime layer.
 */
export class IOClient {
  protected http: HttpClient

  constructor(protected context: BaseIOContext, protected options?: InstanceOptions) {
    this.http = new HttpClient({
      ...context,
      ...options,
    })
  }
}
