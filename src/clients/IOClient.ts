import { IOContext } from '../service/typings'

export abstract class IOClient {
  constructor(
    protected context?: IOContext
  ) {}
}
