import archiver from 'archiver'
import { ZlibOptions } from 'zlib'

import { AppClient, InstanceOptions } from '../HttpClient'
import { CacheType } from '../HttpClient/middlewares/cache'
import { IOContext } from '../service/typings'

import { Change } from './Apps'
import { File } from './Registry'

const routes = {
  SendApp: (app: string) => `${routes.Tester}/test/${app}`,
  Tester: '/_v/tester/0',
}

export class Tester extends AppClient {
  private stickyHost!: string

  constructor(ioContext: IOContext, opts?: InstanceOptions) {
    super('vtex.tester-hub', ioContext, opts)
  }

  public sendAppFiles = (
    app: string,
    srcPath: string,
    zipOptions: ZipOptions = { sticky: true },
    params: RequestParams = {}
  ) => {
    return this.zipAndSend(routes.SendApp(app), app, srcPath, zipOptions, params)
  }

  private zipAndSend = async (
    route: string,
    app: string,
    srcPath: string,
    { tag, sticky, stickyHint, zlib }: ZipOptions = {},
    requestParams: RequestParams = {}
  ) => {
    const zip = archiver('zip', { zlib })
    zip.on('error', e => {
      throw e
    })
    const hint =
      stickyHint ||
      `request:${this.context.account}:${this.context.workspace}:${app}`
    const metric = 'bh-zip-send'
    const params = tag ? { ...requestParams, tag } : requestParams
    const request = this.http.postRaw<any>(route, zip, {
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(sticky && { 'x-vtex-sticky-host': this.stickyHost || hint }),
      },
      metric,
      params,
    })

    zip.directory(srcPath, false)
    const finalize = zip.finalize()

    const [response] = await Promise.all([request, finalize])
    const {
      data,
      headers: { 'x-vtex-sticky-host': host },
    } = response
    this.stickyHost = host
    return data
  }
}

interface RequestParams {
  tsErrorsAsWarnings?: boolean
}

interface ZipOptions {
  sticky?: boolean
  stickyHint?: string
  tag?: string
  zlib?: ZlibOptions
}
