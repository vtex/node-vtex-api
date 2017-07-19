import {createGzip} from 'zlib'
import {basename} from 'path'
import * as mime from 'mime-types'
import {Readable} from 'stream'

import {HttpClient, InstanceOptions} from './HttpClient'
import {FileListItem} from './responses'

const routes = {
  Bucket: (bucket: string) => `/buckets/${bucket}`,
  Files: (bucket: string) => `${routes.Bucket(bucket)}/files`,
  File: (bucket: string, path: string) => `${routes.Bucket(bucket)}/files/${path}`,
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

  listFiles = (bucket: string, prefix?: string) => {
    const params = {prefix}
    return this.http.get<BucketFileList>(routes.Files(bucket), {params})
  }

  getFile = (bucket: string, path: string) => {
    return this.http.getBuffer(routes.File(bucket, path))
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

export type BucketMetadata = {
  state: string,
  lastModified: string,
  hash: string,
}

export type BucketFileList = {
  data: FileListItem[],
  next: string,
  smartCacheHeaders: any,
}
