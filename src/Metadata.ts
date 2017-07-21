import { HttpClient, InstanceOptions } from './HttpClient'

const routes = {
  Bucket: (bucket: string) => `/buckets/${bucket}`,
  Metadata: (bucket: string) => `/buckets/${bucket}/metadata`,
  MetadataKey: (bucket: string, key: string) => `/buckets/${bucket}/metadata/${key}`,
}

export class Metadata {
  private http: HttpClient

  constructor (opts: InstanceOptions) {
    this.http = HttpClient.forWorkspace('router', opts)
  }

  getBuckets = (bucket: string) => {
    return this.http.get(routes.Bucket(bucket))
  }

  list = (bucket: string, includeValue: boolean, limit?: number, nextMarker?: string) => {
    const query: {value: boolean, _limit: number, _marker?: string} = {value: includeValue, _limit: 10}
    if (limit && limit > 0) {
      query._limit = limit
    }
    if (nextMarker) {
      query._marker = nextMarker
    }

    return this.http.get(routes.Metadata(bucket), {params: query})
  }

  listAll = (bucket: string, includeValue: boolean) => {
    const query = {value: includeValue, _limit: 1000}
    return this.http.get(routes.Metadata(bucket), {params: query})
  }

  get = (bucket: string, key: string) => {
    return this.http.get(routes.MetadataKey(bucket, key))
  }

  save = (bucket: string, key: string, data: any) => {
    return this.http.put(routes.MetadataKey(bucket, key), {data})
  }

  saveAll = (bucket: string, data: {[key: string]: any}) => {
    return this.http.put(routes.Metadata(bucket), {data})
  }

  delete = (bucket: string, key: string) => {
    return this.http.delete(routes.MetadataKey(bucket, key))
  }

  deleteAll = (bucket: string) => {
    return this.http.delete(routes.Metadata(bucket))
  }
}
