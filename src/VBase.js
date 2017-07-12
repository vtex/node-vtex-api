/* @flow */
import {createGzip} from 'zlib'
import {basename} from 'path'
import mime from 'mime-types'
import type {Readable} from 'stream'
import {createClient, createWorkspaceURL, noTransforms} from './baseClient'
import type {InstanceOptions} from './baseClient'

type Headers = { [key: string]: string | number }

const routes = {
  Bucket: (bucket: string) =>
    `/buckets/${bucket}`,

  Files: (bucket: string) =>
    `${routes.Bucket(bucket)}/files`,

  File: (bucket: string, path: string) =>
    `${routes.Bucket(bucket)}/files/${path}`,
}

export type VBaseInstance = {
  getBucket: (bucket: string) => any,
  resetBucket: (bucket: string) => any,
  listFiles: (bucket: string, prefix?: string) => any,
  getFile: (bucket: string, path: string) => any,
  saveFile: (bucket: string, path: string, stream: Readable, gzip?: boolean) => any,
  deleteFile: (bucket: string, path: string) => any,
}

export default function VBase (opts: InstanceOptions): VBaseInstance {
  const client = createClient({...opts, baseURL: createWorkspaceURL('vbase', opts)})

  return {
    getBucket: (bucket: string) => {
      return client(routes.Bucket(bucket))
    },

    resetBucket: (bucket: string) => {
      return client.delete(routes.Files(bucket))
    },

    listFiles: (bucket: string, prefix?: string) => {
      const params = {prefix}
      return client(routes.Files(bucket), {params})
    },

    getFile: (bucket: string, path: string) => {
      return client(routes.File(bucket, path), {responseType: 'arraybuffer', transformResponse: noTransforms})
    },

    saveFile: (bucket: string, path: string, stream: Readable, gzip?: boolean = true, ttl?: number) => {
      if (!(stream.pipe && stream.on)) {
        throw new Error('Argument stream must be a readable stream')
      }
      const finalStream = gzip ? stream.pipe(createGzip()) : stream
      const headers: Headers = gzip ? {'Content-Encoding': 'gzip'} : {}
      headers['Content-Type'] = mime.contentType(basename(path))
      if (ttl && Number.isInteger(ttl)) {
        headers['X-VTEX-TTL'] = ttl
      }
      return client.put(routes.File(bucket, path), finalStream, {headers})
    },

    deleteFile: (bucket: string, path: string) => {
      return client.delete(routes.File(bucket, path))
    },
  }
}
