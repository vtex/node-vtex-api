/* @flow */
import Client from './Client'
import type {ClientOptions} from './Client'
import {vtexid} from './endpoints'

const routes = {
  Start: () => '/start',
  Send: () => '/accesskey/send',
  Validate: () => '/accesskey/validate',
  ValidateClassic: () => '/classic/validate',
}

export default class VTEXIDClient extends Client {
  constructor (endpointUrl: string = 'STABLE', options: ClientOptions) {
    super(vtexid(endpointUrl), options)
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
      login: email,
      password: password,
      authenticationToken: token,
    }
    return this.http(routes.ValidateClassic(), {params})
  }
}
