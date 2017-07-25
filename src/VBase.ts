import { createGzip } from 'zlib'
import { basename } from 'path'
import * as mime from 'mime-types'
import { Readable } from 'stream'
import { IncomingMessage } from 'http'

import { HttpClient, InstanceOptions } from './HttpClient'
import { BucketMetadata, FileListItem } from './responses'

const routes = {
  Bucket: (bucket: string) => `/buckets/${bucket}`,
  Files: (bucket: string) => `${routes.Bucket(bucket)}/files`,
  File: (bucket: string, path: string) => `${routes.Bucket(bucket)}/files/${path}`,
}

const isVBaseOptions = (opts?: string | VBaseOptions): opts is VBaseOptions => {
  return typeof opts !== 'string' && !(opts instanceof String)
}

export class VBase {
  private http: HttpClient

  constructor (opts: InstanceOptions) {
    this.http = HttpClient.forWorkspace('vbase', opts)
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
    if (!(stream.pipe && stream.on)) {
      throw new Error('Argument stream must be a readable stream')
    }
    const finalStream = gzip ? stream.pipe(createGzip()) : stream
    const headers: Headers = gzip ? {'Content-Encoding': 'gzip'} : {}
    headers['Content-Type'] = mime.contentType(basename(path)) || 'application/octet-stream'
    if (ttl && Number.isInteger(ttl)) {
      headers['X-VTEX-TTL'] = ttl
    }
    return this.http.put(routes.File(bucket, path), finalStream, {headers})
  }

  deleteFile = (bucket: string, path: string) => {
    return this.http.delete(routes.File(bucket, path))
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
  _limit?: string,
}
