import { InstanceOptions } from '../HttpClient'
import { ClientContext } from '../service/typings'
import { parseAppId } from '../utils'
import { Apps } from './Apps'
import { IOClient } from './IOClient'
import { IOClients } from './IOClients'
import { Registry } from './Registry'

export class AppAssets extends IOClient {
  protected apps: Apps
  protected registry: Registry

  constructor(context: ClientContext<IOClients>, options: InstanceOptions) {
    super(context, options)
    this.apps = context.clients.apps!
    this.registry = context.clients.registry!
  }

  public getFile = (appId: string, path: string) => {
    const {version, name, build} = parseAppId(appId)
    const linked = !!build
    if (linked) {
      return this.apps.getAppFile(appId, path)
    } else {
      return this.registry.getAppFile(name, version, path)
    }
  }

  public getFileStream = (appId: string, path: string) => {
    const {version, name, build} = parseAppId(appId)
    const linked = !!build
    if (linked) {
      return this.apps.getAppFileStream(appId, path)
    } else {
      return this.registry.getAppFileStream(name, version, path)
    }
  }

  public getBundle = (appId: string, bundlePath: string, generatePackageJson: boolean) => {
    const {version, name, build} = parseAppId(appId)
    const linked = !!build
    if (linked) {
      return this.apps.getAppBundle(appId, bundlePath, generatePackageJson)
    } else {
      return this.registry.getAppBundle(name, version, bundlePath, generatePackageJson)
    }
  }

  public unpackBundle = (appId: string, bundlePath: string, unpackPath: string, generatePackageJson: boolean) => {
    const {version, name, build} = parseAppId(appId)
    const linked = !!build
    if (linked) {
      return this.apps.unpackAppBundle(appId, bundlePath, unpackPath, generatePackageJson)
    } else {
      return this.registry.unpackAppBundle(name, version, bundlePath, unpackPath, generatePackageJson)
    }
  }
}
