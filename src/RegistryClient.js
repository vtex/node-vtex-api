/* @flow */
import Multipart from 'multipart-stream'
import {createGzip} from 'zlib'
import {basename} from 'path'
import mime from 'mime-types'
import Stream from 'stream'
import Client from './Client'
import type {ClientOptions} from './Client'
import {api} from './endpoints'

type File = {
  path: string,
  contents: any,
}

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
  constructor (endpointUrl: string = 'STABLE', options: ClientOptions) {
    super(api(endpointUrl), options)
  }

  /**
   * Sends an app as a streaming, gzipped multipart/mixed HTTP POST request.
   * @param account
   * @param workspace
   * @param files An array of {path, contents}, where contents can be a String, a Buffer or a ReadableStream.
   * @return Promise
   */
  publishApp (account: string, workspace: string, files: Array<File>, isDevelopment?: boolean = false) {
    if (!(files[0] && files[0].path && files[0].contents)) {
      throw new Error('Argument files must be an array of {path, contents}, where contents can be a String, a Buffer or a ReadableStream.')
    }
    const indexOfManifest = files.findIndex(({path}) => path === 'manifest.json')
    if (indexOfManifest === -1) {
      throw new Error('No manifest.json file found in files.')
    }
    const sortedFiles = files.splice(indexOfManifest, 1).concat(files)
    const multipart = new Multipart()
    const boundary = multipart.boundary
    sortedFiles.forEach(({path, contents}) => multipart.addPart({
      headers: {
        'Content-Disposition': `inline; filename="${path}"`,
        'Content-Type': mime.contentType(basename(path)),
      },
      body: contents,
    }))
    const gz = createGzip()
    return this.http({
      method: 'POST',
      url: routes.Registry(account, workspace),
      data: multipart.pipe(gz),
      params: {isDevelopment},
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': `multipart/mixed; boundary=${boundary}`,
      },
    })
  }

  publishAppPatch (account: string, workspace: string, vendor: string, name: string, version: string, changes: any) {
    const gz = createGzip()
    const stream = new Stream.Readable()
    stream.push(JSON.stringify(changes))
    stream.push(null)
    return this.http({
      method: 'PATCH',
      data: stream.pipe(gz),
      url: routes.App(account, workspace, vendor, name, version),
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': 'application/json',
      },
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
