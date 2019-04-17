import { InstanceOptions } from '../HttpClient'
import { IOContext } from '../service/typings'

export abstract class IOClient {
  constructor(
    protected context: IOContext,
    protected options: InstanceOptions
  ) {}
}
