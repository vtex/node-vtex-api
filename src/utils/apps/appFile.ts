
import AwaitLock from 'await-lock'
import { head, prop, toString  } from 'ramda'
import * as semver from 'semver'

import { Apps, DiskCache, LRUDiskCache} from '../..'
import { Logger } from '../../service/logger'

const diskCacheStorage = new DiskCache<string>('/cache')
const diskLock = new AwaitLock()
metrics.trackCache('apps-get-file-guard-disk', diskCacheStorage)
const lruDiskCacheStorage = new LRUDiskCache<string>('/cache', {})
const lruLock = new AwaitLock()
metrics.trackCache('get-file-fallback-cache', lruDiskCacheStorage)

const getKey = (app: string, path: string) => `${app}/${path}`
const getFallbackKey = (appName: string, major: string) => `${appName}@${major}`

const save = async (key: string, app: string, file: string) => {
  const [appName, version] = app.split('@')
  const major = head(version.split('.')) || ''
  await diskLock.acquireAsync()
  const result = await diskCacheStorage.set(key, file).catch(err => {
    diskLock.release()
    throw err
  })
  diskLock.release()
  if (!result) {
    return
  }
  const fallbackKey = getFallbackKey(appName, major)

  try {
    await lruLock.acquireAsync()
    if (lruDiskCacheStorage.has(fallbackKey)) {
      const savedVersion = await lruDiskCacheStorage.get(fallbackKey)
      if (savedVersion && semver.gt(version, savedVersion)) {
        await lruDiskCacheStorage.set(fallbackKey, version)
      }
    } else {
      await lruDiskCacheStorage.set(fallbackKey, version)
    }
  } finally {
    lruLock.release()
  }
}

const getFallbackFile = async (app: string) => {
  const [appName, version] = app.split('@')
  const major = head(version.split('.')) || ''
  const fallbackKey = getFallbackKey(appName, major)

  try {
    await lruLock.acquireAsync()
    const fallbackVersion = await lruDiskCacheStorage.get(fallbackKey)
    if (fallbackVersion) {
      return diskCacheStorage.get(fallbackKey)
        .then(file => {
          diskLock.release()
          return file || ''
        })
        .catch(err => {
          diskLock.release()
          throw err
        })
    }
    return Promise.resolve('')
  } finally {
    lruLock.release()
  }
}

export const getAppFile = async (apps: Apps, app: string, path: string, logger: Logger): Promise<string> => {
  const key = getKey(app, path)
  if (diskCacheStorage.has(key)) {
    await diskLock.acquireAsync()
    return diskCacheStorage.get(key)
      .then(file => {
        diskLock.release()
        return file || ''
      })
      .catch(err => {
        diskLock.release()
        throw err
      })
  }
  try {
    return apps.getAppFile(app, path)
      .then(prop('data'))
      .then(toString)
      .then((file) => {
        save(key, app, file)
        return file
      })
  } catch (error) {
    logger.error({ error, message: 'getAppFile failed', app, path })
    return await getFallbackFile(app).then(file => file || '')
  }
}
