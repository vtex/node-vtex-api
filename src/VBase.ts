import { createGzip } from 'zlib'
import { basename } from 'path'
import * as mime from 'mime-types'
import { Readable } from 'stream'
import { IncomingMessage } from 'http'

import { HttpClient, InstanceOptions, IOContext } from './HttpClient'
import { BucketMetadata, FileListItem } from './responses'

const appId = process.env.VTEX_APP_ID
const [runningAppName] = appId ? appId.split('@') : ['']

const routes = {
  Bucket: (bucket: string) => `/buckets/${runningAppName}/${bucket}`,
  Files: (bucket: string) => `${routes.Bucket(bucket)}/files`,
  File: (bucket: string, path: string) => `${routes.Bucket(bucket)}/files/${path}`,
}

const isVBaseOptions = (opts?: string | VBaseOptions): opts is VBaseOptions => {
  return typeof opts !== 'string' && !(opts instanceof String)
}

export class VBase {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    if (runningAppName === '') {
      throw new Error(`Invalid path to access Vbase. Variable VTEX_APP_ID is not available.`)
    }
    this.http = HttpClient.forWorkspace('vbase', ioContext, opts)
  }

  getBucket = (bucket: string) => {
    return this.http.get<BucketMetadata>(routes.Bucket(bucket))
  }

  resetBucket = (bucket: string) => {
    return this.http.delete(routes.Files(bucket))
  }

  listFiles = (bucket: string, opts?: string | VBaseOptions) => {
    let params: VBaseOptions = {}
    if (isVBaseOptions(opts)) {
      params = opts
    } else if (opts) {
      params = {prefix: opts}
    }
    return this.http.get<BucketFileList>(routes.Files(bucket), {params})
  }

  getFile = (bucket: string, path: string) => {
    return this.http.getBuffer(routes.File(bucket, path))
  }

  getFileStream = (bucket: string, path: string): Promise<IncomingMessage> => {
    return this.http.getStream(routes.File(bucket, path))
  }

  saveFile = (bucket: string, path: string, stream: Readable, gzip: boolean = true, ttl?: number) => {
    return this.saveContent(bucket, path, stream, {gzip, ttl})
  }

  saveZippedContent = (bucket: string, path: string, stream: Readable) => {
    return this.saveContent(bucket, path, stream, {unzip: true})
  }

  deleteFile = (bucket: string, path: string) => {
    return this.http.delete(routes.File(bucket, path))
  }

  private saveContent = (bucket: string, path: string, stream: Readable, opts: VBaseSaveOptions = {}) => {
    if (!stream.pipe || !stream.on) {
      throw new Error(`Argument stream must be a readable stream`)
    }
    const params = opts.unzip ? {unzip: opts.unzip} : {}
    const headers: Headers = {}

    let finalStream = stream
    headers['Content-Type'] = mime.contentType(basename(path)) || 'application/octet-stream'
    if (opts.gzip) {
      headers['Content-Encoding'] = 'gzip'
      finalStream = stream.pipe(createGzip())
    }
    if (opts.ttl && Number.isInteger(opts.ttl)) {
      headers['X-VTEX-TTL'] = opts.ttl
    }
    return this.http.put(routes.File(bucket, path), finalStream, {headers, params})
  }
}

type Headers = { [key: string]: string | number }

export type BucketFileList = {
  data: FileListItem[],
  next: string,
  smartCacheHeaders: any,
}

export type VBaseOptions = {
  prefix?: string,
  _next?: string,
  _limit?: number,
}

export type VBaseSaveOptions = {
  gzip?: boolean,
  unzip?: boolean,
  ttl?: number,
}
