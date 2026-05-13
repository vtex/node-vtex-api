import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { ExternalClient } from './ExternalClient'

const routes = {
  SEND: '/accesskey/send',
  START: '/start',
  VALIDATE: '/accesskey/validate',
  VALIDATE_CLASSIC: '/classic/validate',
}

const VTEXID_ENDPOINTS: Record<string, string> = {
  STABLE: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
}

const endpoint = (env: string) => {
  return VTEXID_ENDPOINTS[env] || env
}

export class ID extends ExternalClient {
  constructor (context: IOContext, opts?: InstanceOptions) {
    super(endpoint(VTEXID_ENDPOINTS.STABLE), context, opts)
  }

  public getTemporaryToken = (tracingConfig?: RequestTracingConfig) => {
    const metric = 'vtexid-temp-token'
    const params = this.accountParams()
    return this.http.get<TemporaryToken>(routes.START, {metric, params, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }}).then(({authenticationToken}) => authenticationToken)
  }

  public sendCodeToEmail = (token: string, email: string, tracingConfig?: RequestTracingConfig) => {
    const params = this.accountParams({authenticationToken: token, email})
    const metric = 'vtexid-send-code'
    return this.http.get(routes.SEND, {metric, params, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public getEmailCodeAuthenticationToken = (token: string, email: string, code: string, tracingConfig?: RequestTracingConfig) => {
    const params = this.accountParams({
      accesskey: code,
      authenticationToken: token,
      login: email,
    })
    const metric = 'vtexid-email-token'
    return this.http.get<AuthenticationResponse>(routes.VALIDATE, {metric, params, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public getPasswordAuthenticationToken = (token: string, email: string, password: string, tracingConfig?: RequestTracingConfig) => {
    const params = this.accountParams({
      authenticationToken: token,
      login: email,
      password,
    })
    const metric = 'vtexid-pass-token'
    return this.http.get<AuthenticationResponse>(routes.VALIDATE_CLASSIC, {metric, params, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  private accountParams = (params: Record<string, string> = {}) => ({
    ...params,
    an: this.context.account,
  })
}

interface TemporaryToken {
  authenticationToken: string,
}

export interface AuthenticationResponse {
  promptMFA: boolean,
  clientToken: any,
  authCookie: {
    Name: string,
    Value: string,
  },
  accountAuthCookie: any,
  expiresIn: number,
  userId: string,
  phoneNumber: string,
  scope: any,
}
