import { InstanceOptions } from '../../HttpClient/typings'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

export class Sphinx extends InfraClient {
  constructor(ioContext: IOContext, opts?: InstanceOptions) {
    super('sphinx@0.x', ioContext, opts, false)
  }

  public validatePolicies = (policies: PolicyRequest[]) => {
    return this.http.post(
      '/policies/validate',
      { policies },
      {
        metric: 'sphinx-validate-policy',
      }
    )
  }

  public isAdmin = (email: string) => {
    return this.http.get<boolean>(`/user/${email}/isAdmin`, {
      metric: 'sphinx-is-admin',
    })
  }
}

export interface PolicyRequest {
  name: string
  reason: string
  attrs: Record<string, string>
}
