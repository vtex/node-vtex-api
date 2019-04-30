import { Apps } from '../clients/Apps'
import { Registry } from '../clients/Registry'
import { parseAppId } from './app'

export const getAppJSON = <T extends object | null>(apps: Apps, registry: Registry, appId: string, path: string, nullIfNotFound?: boolean) => {
  const { name, version, build: linked } = parseAppId(appId)
  return linked
    ? apps.getAppJSON<T>(appId, path, nullIfNotFound)
    : registry.getAppJSON<T>(name, version, path, nullIfNotFound)
}

export const getAppFile = (apps: Apps, registry: Registry, appId: string, path: string) => {
  const { name, version, build: linked } = parseAppId(appId)
  return linked
    ? apps.getAppFile(appId, path)
    : registry.getAppFile(name, version, path)
}
