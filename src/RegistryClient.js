/* @flow */
import vmps from 'vinyl-multipart-stream'
import {randomString} from 'vinyl-multipart-stream/common'
import {createGzip} from 'zlib'
import Client from './Client'
import {api} from './endpoints'
import type {Readable} from 'stream'

const routes = {
  Registry: (account: string, workspace: string) =>
    `/${account}/${workspace}/registry`,

  Vendor: (account: string, workspace: string, vendor: string) =>
    `${routes.Registry(account, workspace)}/${vendor}/apps`,

  App: (account: string, workspace: string, vendor: string, name: string, version?: string) =>
    version
    ? `${routes.Vendor(account, workspace, vendor)}/${name}/${version}`
    : `${routes.Vendor(account, workspace, vendor)}/${name}`,
}

export default class RegistryClient extends Client {
  constructor (authToken: string, userAgent: string, endpointUrl: string = 'STABLE') {
    super(authToken, userAgent, api(endpointUrl))
  }

  /**
   * Sends an app as a streaming, gzipped multipart/mixed HTTP POST request.
   * @param account
   * @param workspace
   * @param stream A stream of Vinyl files.
   * @return Promise
   */
  publishApp (account: string, workspace: string, stream: Readable, isDevelopment?: boolean = false) {
    if (!(stream.pipe && stream.on)) {
      throw new Error('Argument stream must be a readable stream of Vinyl files')
    }
    const boundary = randomString()
    const multipart = stream.pipe(vmps({boundary}))
    const gz = createGzip()
    return this.http({
      method: 'POST',
      url: routes.Registry(account, workspace),
      data: multipart.pipe(gz),
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
      url: routes.App(account, workspace, vendor, name, version),
    })
  }

  listVendors (account: string, workspace: string) {
    return this.http(routes.Registry(account, workspace))
  }

  listAppsByVendor (account: string, workspace: string, vendor: string) {
    return this.http(routes.Vendor(account, workspace, vendor))
  }

  listVersionsByApp (account: string, workspace: string, vendor: string, name: string) {
    return this.http(routes.App(account, workspace, vendor, name))
  }

  getAppManifest (account: string, workspace: string, vendor: string, name: string, version: string) {
    return this.http(routes.App(account, workspace, vendor, name, version))
  }

  unpublishApp (account: string, workspace: string, vendor: string, name: string, version: string) {
    return this.http.delete(routes.App(account, workspace, vendor, name, version))
  }
}
