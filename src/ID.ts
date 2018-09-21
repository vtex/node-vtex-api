import {HttpClient, LegacyInstanceOptions} from './HttpClient'

const routes = {
  SEND: '/accesskey/send',
  START: '/start',
  VALIDATE: '/accesskey/validate',
  VALIDATE_CLASSIC: '/classic/validate',
}

const VTEXID_ENDPOINTS: Record<string, string> = {
  BETA: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
  STABLE: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
}

const endpoint = (env: string) => {
  return VTEXID_ENDPOINTS[env] || env
}

export class ID {
  private http: HttpClient
  private defaultHeaders: Record<string, string>

  constructor (endpointUrl: string = 'STABLE', opts: LegacyInstanceOptions) {
    this.defaultHeaders = opts.accept ? {accept: opts.accept} : {}
    this.http = HttpClient.forLegacy(endpoint(endpointUrl), opts)
  }

  public getTemporaryToken = () => {
    return this.http.get<TemporaryToken>(routes.START).then(({authenticationToken}) => authenticationToken)
  }

  public sendCodeToEmail = (token: string, email: string) => {
    const params = {authenticationToken: token, email}
    return this.http.get(routes.SEND, {params, headers: this.defaultHeaders})
  }

  public getEmailCodeAuthenticationToken = (token: string, email: string, code: string) => {
    const params = {
      accesskey: code,
      authenticationToken: token,
      login: email,
    }
    return this.http.get<AuthenticationResponse>(routes.VALIDATE, {params, headers: this.defaultHeaders})
  }

  public getPasswordAuthenticationToken = (token: string, email: string, password: string) => {
    const params = {
      authenticationToken: token,
      login: email,
      password,
    }
    return this.http.get<AuthenticationResponse>(routes.VALIDATE_CLASSIC, {params, headers: this.defaultHeaders})
  }
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
