import * as archiver from 'archiver'

import {HttpClient, InstanceOptions, IOContext} from './HttpClient'
import {File} from './Registry'
import {Change} from './Apps'
import {ZlibOptions} from 'zlib'

const EMPTY_OBJECT = {}

const routes = {
  Availability: (app: string) => `${routes.Builder}/availability/${app}`,
  Builder: '/_v/builder/0',
  Clean: (app: string) => `${routes.Builder}/clean/${app}`,
  Link: (app: string) => `${routes.Builder}/link/${app}`,
  Publish: (app: string) => `${routes.Builder}/publish/${app}`,
  Relink: (app: string) => `${routes.Builder}/relink/${app}`,
}

export class Builder {
  private account: string
  private workspace: string
  private http: HttpClient
  private stickyHost!: string

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    this.http = HttpClient.forWorkspace('builder-hub.vtex', ioContext, opts)
    this.account = ioContext.account
    this.workspace = ioContext.workspace
  }

  public availability = async (app: string, hintIndex: number) => {
    const stickyHint = hintIndex === undefined || hintIndex === null ?
      `request:${this.account}:${this.workspace}:${app}` :
      `request:${this.account}:${this.workspace}:${app}:${hintIndex}`
    const headers = {
      'Content-Type': 'application/json',
      'x-vtex-sticky-host': stickyHint,
    }
    const {data: {availability},
           headers: {'x-vtex-sticky-host': host},
          } = await this.http.getRaw(routes.Availability(app), {headers})
    const {hostname, score} = availability as AvailabilityResponse
    return {host, hostname, score}
  }

  public clean = (app: string) => {
    const headers = {
      'Content-Type': 'application/json',
      ...this.stickyHost && {'x-vtex-sticky-host': this.stickyHost},
    }
    return this.http.post<BuildResult>(routes.Clean(app), {headers})
  }

  public linkApp = (app: string, files: File[], zipOptions: zipOptions = {sticky: true}) => {
    return this.zipAndSend(routes.Link(app), app, files, zipOptions)
  }

  public publishApp = (app: string, files: File[], zipOptions: zipOptions = {sticky: true}) => {
    return this.zipAndSend(routes.Publish(app), app, files, zipOptions)
  }

  public relinkApp = (app: string, changes: Change[]) => {
    const headers = {
      'Content-Type': 'application/json',
      ...this.stickyHost && {'x-vtex-sticky-host': this.stickyHost},
    }
    return this.http.put<BuildResult>(routes.Relink(app), changes, {headers})
  }

  private zipAndSend = async (route: string, app: string, files: File[], {tag, sticky, stickyHint, zlib}: zipOptions = {}) => {
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
    const hint = stickyHint || `request:${this.account}:${this.workspace}:${app}`
    const request = this.http.postRaw<BuildResult>(route, zip, {
      params: tag ? {tag} : EMPTY_OBJECT,
      headers: {
        'Content-Type': 'application/octet-stream',
        ...sticky && {'x-vtex-sticky-host': this.stickyHost || hint},
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

type zipOptions = {
  sticky?: boolean,
  stickyHint?: string,
  tag?: string,
  zlib?: ZlibOptions,
}

export type BuildResult = {
  availability?: AvailabilityResponse
  code?: string,
  message?: any,
  timeNano?: number,
}

export type AvailabilityResponse = {
  host: string | undefined,
  hostname: string | undefined,
  score: number,
}
