/* @flow */
import {createGzip} from 'zlib'
import {basename} from 'path'
import mime from 'mime-types'
import Client from './Client'
import type {ClientOptions} from './Client'
import {vbase} from './endpoints'
import type {Readable} from 'stream'

type Headers = { [key: string]: string }

const CURRENT_MAJOR_VND = 'application/vnd.vtex.vbase.v1+json'
const DEFAULT_WORKSPACE = 'master'
const data = data => data
const noTransforms = [data]

const routes = {
  Account: (account: string) =>
    `/${account}`,

  Workspace: (account: string, workspace: string) =>
    `${routes.Account(account)}/${workspace}`,

  DefaultWorkspace: (account: string) =>
    `${routes.Workspace(account, DEFAULT_WORKSPACE)}`,

  Files: (account: string, workspace: string, bucket: string, path?: string) =>
    `${routes.Workspace(account, workspace)}/buckets/${bucket}/files${path ? '/' + path : ''}`,
}

export default class VBaseClient extends Client {
  constructor (endpointUrl: string = 'STABLE', {authToken, userAgent, accept = CURRENT_MAJOR_VND, timeout}: ClientOptions = {}) {
    super(vbase(endpointUrl), {authToken, userAgent, accept, timeout})
  }

  promote (account: string, workspace: string) {
    return this.http.put(routes.DefaultWorkspace(account, workspace), {workspace})
  }

  list (account: string) {
    return this.http(routes.Account(account))
  }

  create (account: string, workspace: string) {
    return this.http.post(routes.Account(account), {name: workspace})
  }

  get (account: string, workspace: string) {
    return this.http(routes.Workspace(account, workspace))
  }

  delete (account: string, workspace: string) {
    return this.http.delete(routes.Workspace(account, workspace))
  }

  listFiles (account: string, workspace: string, bucket: string, prefix?: string) {
    const params = {prefix}
    return this.http(routes.Files(account, workspace, bucket), {params})
  }

  getFile (account: string, workspace: string, bucket: string, path: string) {
    return this.http(routes.Files(account, workspace, bucket, path), {transformResponse: noTransforms})
  }

  saveFile (account: string, workspace: string, bucket: string, path: string, stream: Readable, gzip?: boolean = true) {
    if (!(stream.pipe && stream.on)) {
      throw new Error('Argument stream must be a readable stream')
    }
    const finalStream = gzip ? stream.pipe(createGzip()) : stream
    const headers: Headers = gzip ? {'Content-Encoding': 'gzip'} : {}
    headers['Content-Type'] = mime.contentType(basename(path))
    return this.http.put(routes.Files(account, workspace, bucket, path), finalStream, {headers})
  }

  deleteFile (account: string, workspace: string, bucket: string, path: string) {
    return this.http.delete(routes.Files(account, workspace, bucket, path))
  }
}
