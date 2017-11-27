import { HttpClient, InstanceOptions } from './HttpClient'
import { BucketMetadata } from './responses'

const routes = {
  Bucket: (appName: string, bucket: string) => `/buckets/${appName}/${bucket}`,
  Metadata: (appName: string, bucket: string) => `/buckets/${appName}/${bucket}/metadata`,
  MetadataKey: (appName: string, bucket: string, key: string) => `/buckets/${appName}/${bucket}/metadata/${key}`,
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
  private appName: string

  constructor (opts: InstanceOptions) {
    this.appName = opts.userAgent.split('/')[0]
    this.http = HttpClient.forWorkspace('router', opts)
  }

  getBuckets = (bucket: string) => {
    return this.http.get<BucketMetadata>(routes.Bucket(this.appName, bucket))
  }

  list = (bucket: string, includeValue: boolean, limit?: number, nextMarker?: string) => {
    const query: {value: boolean, _limit: number, _marker?: string} = {value: includeValue, _limit: 10}
    if (limit && limit > 0) {
      query._limit = limit
    }
    if (nextMarker) {
      query._marker = nextMarker
    }

    return this.http.get<MetadataEntryList>(routes.Metadata(this.appName, bucket), {params: query})
  }

  listAll = (bucket: string, includeValue: boolean) => {
    const query = {value: includeValue, _limit: 1000}
    return this.http.get<MetadataEntryList>(routes.Metadata(this.appName, bucket), {params: query})
  }

  get = (bucket: string, key: string) => {
    return this.http.get<any>(routes.MetadataKey(this.appName, bucket, key))
  }

  save = (bucket: string, key: string, data: any) => {
    return this.http.put(routes.MetadataKey(this.appName, bucket, key), data)
  }

  saveAll = (bucket: string, data: {[key: string]: any}) => {
    return this.http.put(routes.Metadata(this.appName, bucket), data)
  }

  delete = (bucket: string, key: string) => {
    return this.http.delete(routes.MetadataKey(this.appName, bucket, key))
  }

  deleteAll = (bucket: string) => {
    return this.http.delete(routes.Metadata(this.appName, bucket))
  }
}
