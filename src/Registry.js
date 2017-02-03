/* @flow */
import Stream from 'stream'
import archiver from 'archiver'
import {createGzip} from 'zlib'
import {createClient, createWorkspaceURL} from './client'
import type {InstanceOptions} from './client'
import {DefaultWorkspace} from './Workspaces'

type File = {
  path: string,
  contents: any,
}

const routes = {
  Registry: '/registry',

  Vendor: (vendor: string) =>
    `${routes.Registry}/${vendor}/apps`,

  App: (vendor: string, name: string) =>
    `${routes.Vendor(vendor)}/${name}`,

  AppVersion: (vendor: string, name: string, version: string) =>
    `${routes.App(vendor, name)}/${version}`,
}

export default function Registry (opts: InstanceOptions) {
  const client = createClient({
    ...opts,
    baseURL: createWorkspaceURL('apps', {...opts, workspace: DefaultWorkspace}),
  })

  return {
    /**
     * Sends an app as a zip file.
     * @param files An array of {path, contents}, where contents can be a String, a Buffer or a ReadableStream.
     * @return Promise
     */
    publishApp: (files: Array<File>, tag?: string) => {
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
      return client({
        method: 'POST',
        url: routes.Registry,
        data: archive,
        params: tag ? {tag} : {},
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      })
    },

    publishAppPatch: (vendor: string, name: string, version: string, changes: any) => {
      const gz = createGzip()
      const stream = new Stream.Readable()
      stream.push(JSON.stringify(changes))
      stream.push(null)
      return client({
        method: 'PATCH',
        data: stream.pipe(gz),
        url: routes.AppVersion(vendor, name, version),
        headers: {
          'Content-Encoding': 'gzip',
          'Content-Type': 'application/json',
        },
      })
    },

    listVendors: () => {
      return client(routes.Registry)
    },

    listAppsByVendor: (vendor: string) => {
      return client(routes.Vendor(vendor))
    },

    listVersionsByApp: (vendor: string, name: string) => {
      return client(routes.App(vendor, name))
    },

    getAppManifest: (vendor: string, name: string, version: string) => {
      return client(routes.AppVersion(vendor, name, version))
    },

    unpublishApp: (vendor: string, name: string, version: string) => {
      return client.delete(routes.AppVersion(vendor, name, version))
    },
  }
}
