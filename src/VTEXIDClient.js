import request from './http'
import getEndpointUrl from './utils/vtexidEndpoints.js'
import checkRequiredParameters from './utils/required.js'

class VTEXIDClient {
  constructor ({userAgent, endpointUrl = getEndpointUrl('STABLE')}) {
    checkRequiredParameters({userAgent})
    this.endpointUrl = endpointUrl === 'BETA'
      ? getEndpointUrl(endpointUrl)
      : endpointUrl
    this.userAgent = userAgent
    this.headers = {
      'user-agent': this.userAgent,
    }
    this.http = request.defaults({
      headers: this.headers,
    })
  }

  getTemporaryToken () {
    return this.http(`${this.endpointUrl}/start`)
      .thenJson()
      .then(r => r.authenticationToken)
  }

  sendCodeToEmail (token, email) {
    return this.http(`${this.endpointUrl}/accesskey/send`)
      .query({authenticationToken: token, email})
      .thenJson()
  }

  getEmailCodeAuthenticationToken (token, email, code) {
    return this.http(`${this.endpointUrl}/accesskey/validate`)
      .query({login: email, accesskey: code, authenticationToken: token})
      .thenJson()
  }

  getPasswordAuthenticationToken (token, email, password) {
    return this.http(`${this.endpointUrl}/classic/validate`)
      .query({authenticationToken: encodeURIComponent(token), login: encodeURIComponent(email), password: encodeURIComponent(password)})
      .thenJson()
  }
}

export default VTEXIDClient
