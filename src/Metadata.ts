import { InstanceOptions, IOContext } from './HttpClient'
import { forWorkspace, IODataSource } from './IODataSource'
import { BucketMetadata } from './responses'

const appId = process.env.VTEX_APP_ID
const [runningAppName] = appId ? appId.split('@') : ['']

const routes = {
  Bucket: (bucket: string) => `/buckets/${runningAppName}/${bucket}`,
  Metadata: (bucket: string) => `${routes.Bucket(bucket)}/metadata`,
  MetadataKey: (bucket: string, key: string) => `${routes.Metadata(bucket)}/${key}`,
}

export interface MetadataEntry {
  Key: string,
  Hash: string,
  Value: any,
}

export interface MetadataEntryList {
  Data: MetadataEntry[],
  Next: string,
}

export class Metadata extends IODataSource{
  protected service = 'router'
  protected httpClientFactory = forWorkspace

  constructor (context?: IOContext, options: InstanceOptions = {}) {
    super(context, options)
    if (runningAppName === '') {
      throw new Error(`Invalid path to access Metadata. Variable VTEX_APP_ID is not available.`)
    }
  }

  public getBuckets = (bucket: string) => {
    return this.http.get<BucketMetadata>(routes.Bucket(bucket), {metric: 'meta-get-buckets'})
  }

  public list = (bucket: string, includeValue: boolean, limit?: number, nextMarker?: string) => {
    const query: {value: boolean, _limit: number, _marker?: string} = {value: includeValue, _limit: 10}
    if (limit && limit > 0) {
      query._limit = limit
    }
    if (nextMarker) {
      query._marker = nextMarker
    }
    const metric = 'meta-list'

    return this.http.get<MetadataEntryList>(routes.Metadata(bucket), {params: query, metric})
  }

  public listAll = (bucket: string, includeValue: boolean) => {
    const query = {value: includeValue, _limit: 1000}
    const metric = 'meta-list-all'
    return this.http.get<MetadataEntryList>(routes.Metadata(bucket), {params: query, metric})
  }

  public get = (bucket: string, key: string) => {
    return this.http.get<any>(routes.MetadataKey(bucket, key), {metric: 'meta-get'})
  }

  public save = (bucket: string, key: string, data: any) => {
    return this.http.put(routes.MetadataKey(bucket, key), data, {metric: 'meta-save'})
  }

  public saveAll = (bucket: string, data: {[key: string]: any}) => {
    return this.http.put(routes.Metadata(bucket), data, {metric: 'meta-save-all'})
  }

  public delete = (bucket: string, key: string) => {
    return this.http.delete(routes.MetadataKey(bucket, key), {metric: 'meta-delete'})
  }

  public deleteAll = (bucket: string) => {
    return this.http.delete(routes.Metadata(bucket), {metric: 'meta-delete-all'})
  }
}
