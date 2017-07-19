/* @flow */
import {createClient, createRootURL} from './baseClient'
import type {InstanceOptions} from './baseClient'
import {DefaultWorkspace} from './Workspaces'

const routes = {
  Bucket: (account: string, workspace: string, bucket: string) =>
    `/${account}/${workspace}/buckets/${bucket}`,

  Metadata: (account: string, workspace: string, bucket: string) =>
    `/${account}/${workspace}/buckets/${bucket}/metadata`,

  MetadataKey: (account: string, workspace: string, bucket: string, key: string) =>
    `/${account}/${workspace}/buckets/${bucket}/metadata/${key}`,
}

export type MetadataInstance = {
  getBucket: (bucket: string) => any,
  list: (bucket: string, includeValue: boolean, limit?: number, nextMarker?: string) => any,
  listAll: (bucket: string, includeValue: boolean) => any,
  get: (bucket: string, key: string) => any,
  save: (bucket: string, key: string, data: any) => string,
  saveAll: (bucket: string, data: {[key: string]: any}) => string,
  delete: (bucket: string, key: string) => boolean,
  deleteAll: (bucket: string) => void,
}

export default function Metadata (opts: InstanceOptions): MetadataInstance {
  const {account, workspace} = opts
  console.log(opts)
  const client = createClient({
    ...opts,
    baseURL: createRootURL('router', {...opts, workspace: DefaultWorkspace}),
  })

  return {
    getBucket: (bucket: string) => {
      return client.get(routes.Bucket(account, workspace, bucket))
    },

    list: (bucket: string, includeValue: boolean, limit?: number, nextMarker?: string) => {
      let query: {value: boolean, _limit: number, _marker?: string} = {value: includeValue, _limit: 10}
      if (limit && limit > 0) {
        query._limit = limit
      }
      if (nextMarker) {
        query._marker = nextMarker
      }

      return client.get(routes.Metadata(account, workspace, bucket), {params: query})
    },

    listAll: (bucket: string, includeValue: boolean) => {
      const query = {value: includeValue, _limit: 1000}
      return client.get(routes.Metadata(account, workspace, bucket), {params: query})
    },

    get: (bucket: string, key: string) => {
      return client.get(routes.MetadataKey(account, workspace, bucket, key))
    },

    save: (bucket: string, key: string, data: any) => {
      return client.put(routes.MetadataKey(account, workspace, bucket, key), {data})
    },

    saveAll: (bucket: string, data: {[key: string]: any}) => {
      return client.put(routes.Metadata(account, workspace, bucket), {data})
    },

    delete: (bucket: string, key: string) => {
      return client.delete(routes.MetadataKey(account, workspace, bucket, key))
    },

    deleteAll: (bucket: string) => {
      return client.delete(routes.Metadata(account, workspace, bucket))
    },
  }
}
