import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { BucketMetadata } from '../../responses'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

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

export class Metadata extends InfraClient {
  constructor (context: IOContext, options?: InstanceOptions) {
    super('router', context, options)
    if (runningAppName === '') {
      throw new Error(`Invalid path to access Metadata. Variable VTEX_APP_ID is not available.`)
    }
  }

  public getBuckets = (bucket: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'meta-get-buckets'
    return this.http.get<BucketMetadata>(routes.Bucket(bucket), {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public list = (bucket: string, includeValue: boolean, limit?: number, nextMarker?: string, tracingConfig?: RequestTracingConfig) => {
    const query: {value: boolean, _limit: number, _marker?: string} = {value: includeValue, _limit: 10}
    if (limit && limit > 0) {
      query._limit = limit
    }
    if (nextMarker) {
      query._marker = nextMarker
    }
    const metric = 'meta-list'

    return this.http.get<MetadataEntryList>(routes.Metadata(bucket), {metric, params: query, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public listAll = (bucket: string, includeValue: boolean, tracingConfig?: RequestTracingConfig) => {
    const query = {value: includeValue, _limit: 1000}
    const metric = 'meta-list-all'
    return this.http.get<MetadataEntryList>(routes.Metadata(bucket), {metric, params: query, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public get = (bucket: string, key: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'meta-get'
    return this.http.get<any>(routes.MetadataKey(bucket, key), {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public save = (bucket: string, key: string, data: any, tracingConfig?: RequestTracingConfig) => {
    const metric = 'meta-save'
    return this.http.put(routes.MetadataKey(bucket, key), data, {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public saveAll = (bucket: string, data: {[key: string]: any}, tracingConfig?: RequestTracingConfig) => {
    const metric = 'meta-save-all'
    return this.http.put(routes.Metadata(bucket), data, {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public delete = (bucket: string, key: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'meta-delete'
    return this.http.delete(routes.MetadataKey(bucket, key), {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public deleteAll = (bucket: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'meta-delete-all'
    return this.http.delete(routes.Metadata(bucket), {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }
}
