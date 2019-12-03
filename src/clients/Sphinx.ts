import { IOContext } from '../service/typings'
import { InfraClient, InstanceOptions } from './../HttpClient'

const routes = {
  ValidatePolicies: '/policies/validate',
}

export class Sphinx extends InfraClient {
  constructor (ioContext: IOContext, opts?: InstanceOptions) {
    super('sphinx@0.x', ioContext, opts, false)
  }

  public validatePolicies = (policies: PolicyRequest[]) => {
    return this.http.post<void>(routes.ValidatePolicies, policies)
  }
}

export interface PolicyRequest {
  name: string
  reason: string
  attrs: Record<string, string>
}
