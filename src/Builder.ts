import * as archiver from 'archiver'

import {HttpClient, InstanceOptions, IOContext} from './HttpClient'
import {File} from './Registry'
import {Change} from './Apps'

const EMPTY_OBJECT = {}

const routes = {
  Builder: '/_v/builder/0',
  Clean: (app: string) => `${routes.Builder}/clean/${app}`,
  Publish: (app: string) => `${routes.Builder}/publish/${app}`,
  Link: (app: string) => `${routes.Builder}/link/${app}`,
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

  public publishApp = (app: string, files: File[], tag?: string) => {
    return this.zipAndSend(routes.Publish(app), app, files, {tag})
  }

  public linkApp = (app: string, files: File[]) => {
    return this.zipAndSend(routes.Link(app), app, files, {sticky: true})
  }

  public relinkApp = (app: string, changes: Change[]) => {
    const headers = {
      'Content-Type': 'application/json',
      ...this.stickyHost && {'x-vtex-sticky-host': this.stickyHost},
    }
    return this.http.put<BuildResult>(routes.Relink(app), changes, {headers})
  }

  public clean = (app: string) => {
    const headers = {
      'Content-Type': 'application/json',
      ...this.stickyHost && {'x-vtex-sticky-host': this.stickyHost},
    }
    return this.http.post<BuildResult>(routes.Clean(app), {headers})
  }

  private zipAndSend = async (route: string, app: string, files: File[], {tag, sticky}: zipOptions = {}) => {
    if (!(files[0] && files[0].path && files[0].content)) {
      throw new Error('Argument files must be an array of {path, content}, where content can be a String, a Buffer or a ReadableStream.')
    }
    const indexOfManifest = files.findIndex(({path}) => path === 'manifest.json')
    if (indexOfManifest === -1) {
      throw new Error('No manifest.json file found in files.')
    }
    const zip = archiver('zip')
    const stickyHint = `request:${this.account}:${this.workspace}:${app}`
    const request = this.http.postRaw<BuildResult>(route, zip, {
      params: tag ? {tag} : EMPTY_OBJECT,
      headers: {
        'Content-Type': 'application/octet-stream',
        ...sticky && {'x-vtex-sticky-host': this.stickyHost || stickyHint},
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
  tag?: string,
}

export type BuildResult = {
  code?: string,
  message?: any,
  timeNano?: number,
}
