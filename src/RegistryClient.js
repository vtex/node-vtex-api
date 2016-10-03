/* @flow */
import vmps from 'vinyl-multipart-stream'
import {randomString} from 'vinyl-multipart-stream/common.js'
import {createGzip} from 'zlib'
import Client from './Client'
import getUrl from './utils/apiEndpoints.js'

export default class RegistryClient extends Client {
  constructor (authToken: string, userAgent: string, endpointUrl: string = 'STABLE') {
    super(authToken, userAgent, getUrl(endpointUrl))
    this.routes = {
      Registry: (account: string, workspace: string) =>
        `/${account}/${workspace}/registry`,

      Vendor: (account: string, workspace: string, vendor: string) =>
        `${this.Registry(account, workspace)}/${vendor}/apps`,

      App: (account: string, workspace: string, vendor: string, name: string, version?: string) =>
        version
        ? `${this.Vendor(account, workspace, vendor)}/${name}/${version}`
        : `${this.Vendor(account, workspace, vendor)}/${name}`,
    }
  }

  /**
   * Sends an app as a streaming, gzipped multipart/mixed HTTP POST request.
   * @param account
   * @param workspace
   * @param vinylStream A stream of Vinyl files.
   * @return Promise
   */
  publishApp (account: string, workspace: string, vinylStream: ReadStream, isDevelopment: boolean = false) {
    const boundary = randomString()
    const stream = vinylStream.pipe(vmps({boundary}))
    const gz = createGzip()
    return this.http({
      method: 'POST',
      url: this.routes.Registry(account, workspace),
      data: stream.pipe(gz),
      params: {isDevelopment},
      headers: {
        'Content-Type': `multipart/mixed; boundary=${boundary}`,
      },
    })
  }

  publishAppPatch (account: string, workspace: string, vendor: string, name: string, version: string, changes: any) {
    return this.http({
      method: 'PATCH',
      data: changes,
      url: this.routes.App(account, workspace, vendor, name, version),
    })
  }

  listVendors (account: string, workspace: string) {
    return this.http(this.routes.Registry(account, workspace))
  }

  listAppsByVendor (account: string, workspace: string, vendor: string) {
    return this.http(this.routes.Vendor(account, workspace, vendor))
  }

  listVersionsByApp (account: string, workspace: string, vendor: string, name: string) {
    return this.http(this.routes.App(account, workspace, vendor, name))
  }

  getAppManifest (account, workspace, vendor, name, version) {
    return this.http(this.routes.App(account, workspace, vendor, name, version))
  }

  unpublishApp (account, workspace, vendor, name, version) {
    return this.http.delete(this.routes.App(account, workspace, vendor, name, version))
  }
}
