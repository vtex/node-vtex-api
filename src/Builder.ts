import * as archiver from 'archiver'

import {HttpClient, InstanceOptions} from './HttpClient'
import {File} from './Registry'
import {Change} from './Apps'

const routes = {
  Builder: '/_v/builder/0/',
  Publish: (app: string) => `${routes.Builder}/publish/${app}`,
  Link: (app: string) => `${routes.Builder}/link/${app}`,
  Relink: (app: string) => `${routes.Builder}/relink/${app}`,
}

export class Builder {
  private http: HttpClient

  constructor (opts: InstanceOptions) {
    this.http = HttpClient.forWorkspace('vtex.builder-hub', opts)
  }

  public publishApp = (app: string, files: File[]) => {
    return this.zipAndSend(routes.Publish(app), app, files)
  }

  public linkApp = (app: string, files: File[]) => {
    return this.zipAndSend(routes.Link(app), app, files)
  }

  public relinkApp = (app: string, changes: Change[]) => {
    const headers = {'Content-Type': 'application/json'}
    return this.http.put(routes.Relink(app), changes, {headers})
  }

  private zipAndSend = (route: string, app: string, files: File[]) => {
    if (!(files[0] && files[0].path && files[0].contents)) {
      throw new Error('Argument files must be an array of {path, contents}, where contents can be a String, a Buffer or a ReadableStream.')
    }
    const indexOfManifest = files.findIndex(({path}) => path === 'manifest.json')
    if (indexOfManifest === -1) {
      throw new Error('No manifest.json file found in files.')
    }
    const archive = archiver('zip')
    files.forEach(({contents, path}) => archive.append(contents, {name: path}))
    archive.finalize()
    return this.http.post(route, archive, {
      headers: {'Content-Type': 'application/octet-stream'},
    })
  }
}
