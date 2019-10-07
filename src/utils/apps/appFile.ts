
import { head, prop, toString  } from 'ramda'
import * as semver from 'semver'

import { Apps } from '../..'
import { CacheLayer } from '../../caches'
import { Logger } from '../../service/logger'


const getFallbackKey = (appName: string, major: string) => `${appName}@${major}`

const save = async (app: string, cacheStorage: CacheLayer<string, string>) => {
  const [appName, version] = app.split('@')
  const major = head(version.split('.')) || ''

  const fallbackKey = getFallbackKey(appName, major)
  if (cacheStorage.has(fallbackKey)) {
    const savedVersion = await cacheStorage.get(fallbackKey)
    if (savedVersion && semver.gt(version, savedVersion)) {
      await cacheStorage.set(fallbackKey, version)
    }
  } else {
    await cacheStorage.set(fallbackKey, version)
  }
}

const getFallbackFile = async (app: string, path: string, cacheStorage: CacheLayer<string, string>, apps: Apps) => {
  const [appName, version] = app.split('@')
  const major = head(version.split('.')) || ''
  const fallbackKey = getFallbackKey(appName, major)

  const fallbackVersion = await cacheStorage.get(fallbackKey)
  if (fallbackVersion) {
    const appFallbackVersion = `${appName}@${fallbackVersion}`
    return apps.getAppFile(appFallbackVersion, path)
      .then(prop('data'))
      .then(toString)
  }
  return Promise.resolve('')
}

export const getAppFile = async (apps: Apps, app: string, path: string, cacheStorage: CacheLayer<string, string>, logger: Logger): Promise<string> => {
  try {
    const file = await apps.getAppFile(app, path)
      .then(prop('data'))
      .then(toString)
    save(app, cacheStorage)
    return file
  } catch (error) {
    logger.error({ error, message: 'getAppFile failed', app, path })
    return await getFallbackFile(app, path, cacheStorage, apps).then(file => file || '')
  }
}
