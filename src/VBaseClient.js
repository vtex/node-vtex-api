import request from './http'
import getEndpointUrl from './utils/vbaseEndpoints.js'
import checkRequiredParameters from './utils/required.js'

class VBaseClient {
  constructor ({authToken, userAgent, endpointUrl = getEndpointUrl('STABLE')}) {
    checkRequiredParameters({authToken, userAgent})
    this.authToken = authToken
    this.endpointUrl = endpointUrl === 'BETA'
      ? getEndpointUrl(endpointUrl)
      : endpointUrl
    this.userAgent = userAgent
    this.headers = {
      authorization: `token ${this.authToken}`,
      'user-agent': this.userAgent,
    }
    this.http = request.defaults({
      headers: this.headers,
    })
  }

  promote (account, workspace) {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.WorkspaceMaster(account, workspace)}`

    return this.http.put(url).send({workspace}).json()
  }

  list (account) {
    checkRequiredParameters({account})
    const url = `${this.endpointUrl}${this.routes.Account(account)}`

    return this.http.get(url).json()
  }

  create (account, workspace) {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.Account(account)}`

    return this.http.post(url).send({name: workspace}).json()
  }

  get (account, workspace) {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.Workspace(account, workspace)}`

    return this.http.get(url).json()
  }

  delete (account, workspace) {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.Workspace(account, workspace)}`

    return this.http.delete(url).json()
  }
}

VBaseClient.prototype.routes = {
  Account (account) {
    return `/${account}`
  },

  Workspace (account, workspace) {
    return `${this.Account(account)}/${workspace}`
  },

  WorkspaceMaster (account, workspace) {
    return `${this.Workspace(account, workspace)}/master`
  },
}

export default VBaseClient
