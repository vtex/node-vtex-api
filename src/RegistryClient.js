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

const CURRENT_MAJOR_VND = 'application/vnd.vtex.sppa.v4+json'

const routes = {
  Registry: (account: string) =>
    `/${account}/master/registry`,

  Vendor: (account: string, vendor: string) =>
    `${routes.Registry(account)}/${vendor}/apps`,

  App: (account: string, vendor: string, name: string, version?: string) =>
    version
    ? `${routes.Vendor(account, vendor)}/${name}/${version}`
    : `${routes.Vendor(account, vendor)}/${name}`,
}

export default class RegistryClient extends Client {
  constructor (endpointUrl: string = 'STABLE', {authToken, userAgent, accept = CURRENT_MAJOR_VND, timeout}: ClientOptions = {}) {
    super(api(endpointUrl), {authToken, userAgent, accept, timeout})
  }

  /**
   * Sends an app as a streaming, gzipped multipart/mixed HTTP POST request.
   * @param account
   * @param files An array of {path, contents}, where contents can be a String, a Buffer or a ReadableStream.
   * @return Promise
   */
  publishApp (account: string, files: Array<File>, tag?: string) {
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
      url: routes.Registry(account),
      data: multipart.pipe(gz),
      params: tag ? {tag} : {},
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': `multipart/mixed; boundary=${boundary}`,
      },
    })
  }

  publishAppPatch (account: string, vendor: string, name: string, version: string, changes: any) {
    const gz = createGzip()
    const stream = new Stream.Readable()
    stream.push(JSON.stringify(changes))
    stream.push(null)
    return this.http({
      method: 'PATCH',
      data: stream.pipe(gz),
      url: routes.App(account, vendor, name, version),
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': 'application/json',
      },
    })
  }

  listVendors (account: string) {
    return this.http(routes.Registry(account))
  }

  listAppsByVendor (account: string, vendor: string) {
    return this.http(routes.Vendor(account, vendor))
  }

  listVersionsByApp (account: string, vendor: string, name: string) {
    return this.http(routes.App(account, vendor, name))
  }

  getAppManifest (account: string, vendor: string, name: string, version: string) {
    return this.http(routes.App(account, vendor, name, version))
  }

  unpublishApp (account: string, vendor: string, name: string, version: string) {
    return this.http.delete(routes.App(account, vendor, name, version))
  }
}
