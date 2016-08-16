import request from './http'
import getEndpointUrl from './utils/apiEndpoints.js'
import checkRequiredParameters from './utils/required.js'

class AppsClient {
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

  installApp (account, workspace, descriptor) {
    checkRequiredParameters({account, workspace, descriptor})
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace)}`

    return this.http.post(url).send(descriptor).thenJson()
  }

  uninstallApp (account, workspace, app) {
    checkRequiredParameters({account, workspace, app})
    const url = `${this.endpointUrl}${this.routes.App(account, workspace, app)}`

    return this.http.delete(url).thenJson()
  }

  updateAppSettings (account, workspace, app, settings) {
    checkRequiredParameters({account, workspace, app, settings})
    const url = `${this.endpointUrl}${this.routes.App(account, workspace, app)}`

    return this.http.put(url).send({
      settings,
    }).thenJson()
  }

  updateAppTtl (account, workspace, app) {
    checkRequiredParameters({account, workspace, app})
    const url = `${this.endpointUrl}${this.routes.App(account, workspace, app)}`

    return this.http.patch(url).thenJson()
  }

  listApps (account, workspace, options = {oldVersion: '', context: '', since: '', service: ''}) {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace)}`
    const {oldVersion, context, since, service} = options

    return this.http.get(url).query({
      oldVersion,
      context,
      since,
      service,
    }).thenJson()
  }

  listAppFiles (account, workspace, app, {prefix = '', context = '', nextMarker = ''}) {
    checkRequiredParameters({account, workspace, app})
    const url = `${this.endpointUrl}${this.routes.Files(account, workspace, app)}`

    return this.http.get(url).query({
      prefix,
      context,
      nextMarker,
    }).thenJson()
  }

  getAppFile (account, workspace, app, path, context = '') {
    checkRequiredParameters({account, workspace, app, path})
    const url = `${this.endpointUrl}${this.routes.File(account, workspace, app, path)}`

    return this.http.get(url).query({
      context,
    }).thenJson()
  }

  getApp (account, workspace, app, context = '') {
    checkRequiredParameters({account, workspace, app})
    const url = `${this.endpointUrl}${this.routes.App(account, workspace, app)}`

    return this.http.get(url).query({
      context,
    }).thenJson()
  }

  getDependencyMap (account, workspace, service = '') {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.DependencyMap(account, workspace)}`

    return this.http.get(url).query({
      service,
    }).thenJson()
  }
}

AppsClient.prototype.routes = {
  Apps (account, workspace) {
    return `/${account}/${workspace}/apps`
  },

  App (account, workspace, app) {
    return `${this.Apps(account, workspace)}/${app}`
  },

  Files (account, workspace, app) {
    return `${this.App(account, workspace, app)}/files`
  },

  File (account, workspace, app, path) {
    return `${this.Files(account, workspace, app)}/${path}`
  },

  DependencyMap (account, workspace) {
    return `/${account}/${workspace}/dependencyMap`
  },
}

export default AppsClient
