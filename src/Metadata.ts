import { HttpClient, InstanceOptions } from './HttpClient'
import { BucketMetadata } from './responses'

const routes = {
  Bucket: (bucket: string) => {
    if (!process.env.VTEX_APP_ID) {
      throw new Error(`Invalid path to access Metadata. Variable VTEX_APP_ID is not available.`)
    }
    return `/buckets/${process.env.VTEX_APP_ID}/${bucket}`
  },
  Metadata: (bucket: string) => `${routes.Bucket(bucket)}/metadata`,
  MetadataKey: (bucket: string, key: string) => `${routes.Metadata(bucket)}/${key}`,
}

export type MetadataEntry = {
  Key: string,
  Hash: string,
  Value: any,
}

export type MetadataEntryList = {
  Data: MetadataEntry[],
  Next: string,
}

export class Metadata {
  private http: HttpClient

  constructor (opts: InstanceOptions) {
    this.http = HttpClient.forWorkspace('router', opts)
  }

  getBuckets = (bucket: string) => {
    return this.http.get<BucketMetadata>(routes.Bucket(bucket))
  }

  list = (bucket: string, includeValue: boolean, limit?: number, nextMarker?: string) => {
    const query: {value: boolean, _limit: number, _marker?: string} = {value: includeValue, _limit: 10}
    if (limit && limit > 0) {
      query._limit = limit
    }
    if (nextMarker) {
      query._marker = nextMarker
    }

    return this.http.get<MetadataEntryList>(routes.Metadata(bucket), {params: query})
  }

  listAll = (bucket: string, includeValue: boolean) => {
    const query = {value: includeValue, _limit: 1000}
    return this.http.get<MetadataEntryList>(routes.Metadata(bucket), {params: query})
  }

  get = (bucket: string, key: string) => {
    return this.http.get<any>(routes.MetadataKey(bucket, key))
  }

  save = (bucket: string, key: string, data: any) => {
    return this.http.put(routes.MetadataKey(bucket, key), data)
  }

  saveAll = (bucket: string, data: {[key: string]: any}) => {
    return this.http.put(routes.Metadata(bucket), data)
  }

  delete = (bucket: string, key: string) => {
    return this.http.delete(routes.MetadataKey(bucket, key))
  }

  deleteAll = (bucket: string) => {
    return this.http.delete(routes.Metadata(bucket))
  }
}
