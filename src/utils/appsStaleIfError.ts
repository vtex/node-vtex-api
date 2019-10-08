import crypto from 'crypto'
import { head } from 'ramda'
import * as semver from 'semver'

import { AppMetaInfo, Apps } from '..'
import { CacheLayer } from '../caches'
import { Logger } from '../service/logger'

export const getMetaInfoKey = (account: string) => `${account}-meta-infos`

const hashMD5 = (text: string) =>
  crypto
    .createHash('md5')
    .update(text)
    .digest('hex')

export const updateMetaInfoCache = async (cacheStorage: CacheLayer<string, AppMetaInfo[]>, account: string, workspace: string, dependencies: AppMetaInfo[], logger: Logger) => {
  if (workspace !== 'master') {
    return
  }
  const key = getMetaInfoKey(account)
  const hash = hashMD5(dependencies.toString())

  try {
    const storedDependencies = await cacheStorage.get(key) || ''
    if (hash !== hashMD5(storedDependencies.toString())) {
      await cacheStorage.set(key, dependencies)
    }
  } catch (error) {
    logger.error({error, message: 'Apps disk cache update failed'})
  }
  return
}

const getFallbackKey = (appName: string, major: string) => `${appName}@${major}`

export const saveVersion = async (app: string, cacheStorage: CacheLayer<string, string>) => {
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

export const getFallbackFile = async (app: string, path: string, cacheStorage: CacheLayer<string, string>, apps: Apps): Promise<{data: Buffer, headers: any }> => {
  const [appName, version] = app.split('@')
  const major = head(version.split('.')) || ''
  const fallbackKey = getFallbackKey(appName, major)

  const fallbackVersion = await cacheStorage.get(fallbackKey)
  if (fallbackVersion) {
    const appFallbackVersion = `${appName}@${fallbackVersion}`
    return apps.getAppFile(appFallbackVersion, path)
  }
  throw Error('Fallback version was not found')
}


