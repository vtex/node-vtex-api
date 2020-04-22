import { InstanceOptions, RequestTracingConfig } from '../../HttpClient/typings'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

export class Sphinx extends InfraClient {
  constructor (ioContext: IOContext, opts?: InstanceOptions) {
    super('sphinx@0.x', ioContext, opts, false)
  }

  public validatePolicies = (policies: PolicyRequest[], tracingConfig?: RequestTracingConfig) => {
    const metric = 'sphinx-validate-policy'
    return this.http.post<void>('/policies/validate', { policies }, {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public isAdmin = (email: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'sphinx-is-admin'
    return this.http.get<boolean>(`/user/${email}/isAdmin`, {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }
}

export interface PolicyRequest {
  name: string
  reason: string
  attrs: Record<string, string>
}
