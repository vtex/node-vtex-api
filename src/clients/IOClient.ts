import { IOContext } from '../service/worker/runtime/typings'

import { HttpClient } from '../HttpClient/HttpClient'
import { InstanceOptions } from '../HttpClient/typings'

export type IOClientConstructor = new (context: IOContext, options?: InstanceOptions) => IOClient

/**
 * A client that can be instantiated by the Serviceruntime layer.
 */
export class IOClient {
  protected http: HttpClient

  constructor(protected context: IOContext, protected options?: InstanceOptions) {
    this.http = new HttpClient({
      name: this.constructor.name,
      ...context,
      ...options,
      metrics: options && options.metrics,
    })
  }
}
