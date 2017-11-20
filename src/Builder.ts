import * as archiver from 'archiver'

import {HttpClient, InstanceOptions} from './HttpClient'
import {File} from './Registry'
import {Change} from './Apps'

const EMPTY_OBJECT = {}

const routes = {
  Builder: '/_v/builder/0',
  Publish: (app: string) => `${routes.Builder}/publish/${app}`,
  Link: (app: string) => `${routes.Builder}/link/${app}`,
  Relink: (app: string) => `${routes.Builder}/relink/${app}`,
}

export class Builder {
  private http: HttpClient

  constructor (opts: InstanceOptions) {
    this.http = HttpClient.forWorkspace('builder-hub.vtex', opts)
  }

  public publishApp = (app: string, files: File[], tag?: string) => {
    return this.zipAndSend(routes.Publish(app), app, files, tag)
  }

  public linkApp = (app: string, files: File[]) => {
    return this.zipAndSend(routes.Link(app), app, files)
  }

  public relinkApp = (app: string, changes: Change[]) => {
    const headers = {'Content-Type': 'application/json'}
    return this.http.put<BuildResult>(routes.Relink(app), changes, {headers})
  }

  private zipAndSend = (route: string, app: string, files: File[], tag?: string) => {
    if (!(files[0] && files[0].path && files[0].content)) {
      throw new Error('Argument files must be an array of {path, contents}, where contents can be a String, a Buffer or a ReadableStream.')
    }
    const indexOfManifest = files.findIndex(({path}) => path === 'manifest.json')
    if (indexOfManifest === -1) {
      throw new Error('No manifest.json file found in files.')
    }
    const archive = archiver('zip')
    files.forEach(({content, path}) => archive.append(content, {name: path}))
    archive.finalize()
    return this.http.post<BuildResult>(route, archive, {
      params: tag ? {tag} : EMPTY_OBJECT,
      headers: {'Content-Type': 'application/octet-stream'},
    })
  }
}

export type BuildResult = {
  error?: any,
  success: boolean,
  timeNano?: number,
}
