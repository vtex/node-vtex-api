import { InstanceOptions, IOContext } from './HttpClient'
import { BucketMetadata } from './responses'
import { IODataSource, workspaceClientFactory } from './utils/dataSource'

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
  constructor (context?: IOContext, options: InstanceOptions = {}) {
    super(workspaceClientFactory, {
      context,
      options,
      service: 'router',
    })
    if (runningAppName === '') {
      throw new Error(`Invalid path to access Metadata. Variable VTEX_APP_ID is not available.`)
    }
  }

  public getBuckets = (bucket: string) => {
    return this.http.get<BucketMetadata>(routes.Bucket(bucket))
  }

  public list = (bucket: string, includeValue: boolean, limit?: number, nextMarker?: string) => {
    const query: {value: boolean, _limit: number, _marker?: string} = {value: includeValue, _limit: 10}
    if (limit && limit > 0) {
      query._limit = limit
    }
    if (nextMarker) {
      query._marker = nextMarker
    }

    return this.http.get<MetadataEntryList>(routes.Metadata(bucket), {params: query})
  }

  public listAll = (bucket: string, includeValue: boolean) => {
    const query = {value: includeValue, _limit: 1000}
    return this.http.get<MetadataEntryList>(routes.Metadata(bucket), {params: query})
  }

  public get = (bucket: string, key: string) => {
    return this.http.get<any>(routes.MetadataKey(bucket, key))
  }

  public save = (bucket: string, key: string, data: any) => {
    return this.http.put(routes.MetadataKey(bucket, key), data)
  }

  public saveAll = (bucket: string, data: {[key: string]: any}) => {
    return this.http.put(routes.Metadata(bucket), data)
  }

  public delete = (bucket: string, key: string) => {
    return this.http.delete(routes.MetadataKey(bucket, key))
  }

  public deleteAll = (bucket: string) => {
    return this.http.delete(routes.Metadata(bucket))
  }
}
