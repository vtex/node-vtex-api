/* @flow */
import Client from './Client'
import {vtexid} from './endpoints'

const routes = {
  Start: () => '/start',
  Send: () => '/accesskey/send',
  Validate: () => '/accesskey/validate',
  ValidateClassic: () => '/classic/validate',
}

export default class VTEXIDClient extends Client {
  constructor (authToken: string, userAgent: string, endpointUrl: string = 'STABLE') {
    super(authToken, userAgent, vtexid(endpointUrl))
  }

  getTemporaryToken () {
    return this.http(routes.Start()).then(r => r.authenticationToken)
  }

  sendCodeToEmail (token: string, email: string) {
    const params = {authenticationToken: token, email}
    return this.http(routes.Send(), {params})
  }

  getEmailCodeAuthenticationToken (token: string, email: string, code: string) {
    const params = {
      login: email,
      accesskey: code,
      authenticationToken: token,
    }
    return this.http(routes.Validate(), {params})
  }

  getPasswordAuthenticationToken (token: string, email: string, password: string) {
    const params = {
      authenticationToken: encodeURIComponent(token),
      login: encodeURIComponent(email),
      password: encodeURIComponent(password),
    }
    return this.http(routes.ValidateClassic(), {params})
  }
}
