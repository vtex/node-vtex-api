import archiver from 'archiver'
import { ZlibOptions } from 'zlib'

import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { CacheType } from '../../HttpClient/middlewares/cache'
import { IOContext } from '../../service/worker/runtime/typings'
import { Change } from '../infra/Apps'
import { File } from '../infra/Registry'
import { AppClient } from './AppClient'

const routes = {
  Availability: (app: string) => `${routes.Builder}/availability/${app}`,
  Builder: '/_v/builder/0',
  Clean: (app: string) => `${routes.Builder}/clean/${app}`,
  Link: (app: string) => `${routes.Builder}/link/${app}`,
  PinnedDependencies: () => `${routes.Builder}/pinneddeps`,
  Publish: (app: string) => `${routes.Builder}/publish/${app}`,
  Relink: (app: string) => `${routes.Builder}/relink/${app}`,
  Test: (app: string) => `${routes.Builder}/test/${app}`,
}

export class Builder extends AppClient {
  private stickyHost!: string

  constructor (ioContext: IOContext, opts?: InstanceOptions) {
    super('vtex.builder-hub@0.x', ioContext, opts)
  }

  public availability = async (app: string, hintIndex: number, tracingConfig?: RequestTracingConfig) => {
    const stickyHint = hintIndex === undefined || hintIndex === null ?
      `request:${this.context.account}:${this.context.workspace}:${app}` :
      `request:${this.context.account}:${this.context.workspace}:${app}:${hintIndex}`
    const headers = {
      'Content-Type': 'application/json',
      'x-vtex-sticky-host': stickyHint,
    }
    const metric = 'bh-availability'
    const {data: {availability},
           headers: {'x-vtex-sticky-host': host},
          } = await this.http.getRaw(routes.Availability(app), {cacheable: CacheType.None, headers, metric, tracing: {
            requestSpanNameSuffix: metric,
            ...tracingConfig?.tracing,
          }})
    const {hostname, score} = availability as AvailabilityResponse
    return {host, hostname, score}
  }

  public clean = (app: string, tracingConfig?: RequestTracingConfig) => {
    const headers = {
      'Content-Type': 'application/json',
      ...this.stickyHost && {'x-vtex-sticky-host': this.stickyHost},
    }
    const metric = 'bh-clean'
    return this.http.post<BuildResult>(routes.Clean(app), {headers, metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public getPinnedDependencies = (tracingConfig?: RequestTracingConfig) => {
    return this.http.get(routes.PinnedDependencies(), {
      tracing: {
        requestSpanNameSuffix: 'pinned-dependencies',
        ...tracingConfig?.tracing,
      },
    })
  }

  public linkApp = (app: string, files: File[], zipOptions: ZipOptions = {sticky: true}, params: RequestParams = {}, tracingConfig?: RequestTracingConfig) => {
    return this.zipAndSend(routes.Link(app), app, files, zipOptions, params, tracingConfig)
  }

  public publishApp = (app: string, files: File[], zipOptions: ZipOptions = {sticky: true}, params: RequestParams = {}, tracingConfig?: RequestTracingConfig) => {
    return this.zipAndSend(routes.Publish(app), app, files, zipOptions, params, tracingConfig)
  }

  public relinkApp = (app: string, changes: Change[], params: RequestParams = {}, tracingConfig?: RequestTracingConfig) => {
    const headers = {
      'Content-Type': 'application/json',
      ...this.stickyHost && {'x-vtex-sticky-host': this.stickyHost},
    }
    const metric = 'bh-relink'
    return this.http.put<BuildResult>(routes.Relink(app), changes, {headers, metric, params, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public testApp = (app: string, files: File[], zipOptions: ZipOptions = {sticky: true}, params: RequestParams = {}, tracingConfig?: RequestTracingConfig) => {
    return this.zipAndSend(routes.Test(app), app, files, zipOptions, params, tracingConfig)
  }

  private zipAndSend = async (route: string, app: string, files: File[], {tag, sticky, stickyHint, zlib}: ZipOptions = {}, requestParams: RequestParams = {}, tracingConfig?: RequestTracingConfig) => {
    if (!(files[0] && files[0].path && files[0].content)) {
      throw new Error('Argument files must be an array of {path, content}, where content can be a String, a Buffer or a ReadableStream.')
    }
    const indexOfManifest = files.findIndex(({path}) => path === 'manifest.json')
    if (indexOfManifest === -1) {
      throw new Error('No manifest.json file found in files.')
    }
    const zip = archiver('zip', {zlib})
    // Throw stream errors so they reject the promise chain.
    zip.on('error', (e) => {
      throw e
    })
    const hint = stickyHint || `request:${this.context.account}:${this.context.workspace}:${app}`
    const metric = 'bh-zip-send'
    const params = tag ? {...requestParams, tag} : requestParams
    const request = this.http.postRaw<BuildResult>(route, zip, {
      headers: {
        'Content-Type': 'application/octet-stream',
        ...sticky && {'x-vtex-sticky-host': this.stickyHost || hint},
      },
      metric,
      params,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })

    files.forEach(({content, path}) => zip.append(content, {name: path}))
    const finalize = zip.finalize()

    const [response] = await Promise.all([request, finalize])
    const {data, headers: {'x-vtex-sticky-host': host}} = response
    this.stickyHost = host
    return data
  }
}

interface RequestParams {
  tsErrorsAsWarnings?: boolean,
  skipSemVerEnsure?: boolean,
}

interface ZipOptions {
  sticky?: boolean,
  stickyHint?: string,
  tag?: string,
  zlib?: ZlibOptions,
}

export interface BuildResult {
  availability?: AvailabilityResponse
  code?: string,
  message?: any,
  timeNano?: number,
}

export interface AvailabilityResponse {
  host: string | undefined,
  hostname: string | undefined,
  score: number,
}
