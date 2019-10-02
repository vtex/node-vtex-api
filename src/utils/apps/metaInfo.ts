import AwaitLock from 'await-lock'
import crypto from 'crypto'

import { AppMetaInfo, Apps, DiskCache, IOContext } from '../..'
import { Logger } from '../../service/logger'

const diskCacheStorage = new DiskCache<AppMetaInfo[]>('/cache')
metrics.trackCache('apps-guard-disk', diskCacheStorage)

const getKey = (account: string) => `${account}-meta-infos`

const hashMD5 = (text: string) =>
  crypto
    .createHash('md5')
    .update(text)
    .digest('hex')

const locks: Record<string, AwaitLock> = {}

const updateCache = async (account: string, workspace: string, dependencies: AppMetaInfo[], logger: Logger) => {
  if (workspace !== 'fox2') {
    return
  }
  const key = getKey(account)
  const hash = hashMD5(dependencies.toString())

  try {
    const storedDependencies = await diskCacheStorage.get(key) || ''
      if (hash !== hashMD5(storedDependencies.toString())) {
        await diskCacheStorage.set(key, dependencies)
      }
  } catch (error) {
    logger.error({error, message: 'Apps disk cache update failed'})
  }

  return
}

export const getAppsMetaInfo = async (apps: Apps, ioContext: IOContext): Promise<AppMetaInfo[]> => {
  const { account, workspace, logger } = ioContext

  if (!locks[account]) {
    locks[account] = new AwaitLock()
  }

  const lock = locks[account]
  try {
    const dependencies = await apps.getAppsMetaInfos()
    await lock.acquireAsync()
    updateCache(account, workspace, dependencies, logger)
    return dependencies
  } catch (error) {
    if (workspace !== 'fox2') {
      return []
    }
    await lock.acquireAsync()
    const dependencies = await diskCacheStorage.get(getKey(account)) || []
    return dependencies
  } finally {
    lock.release()
  }
}
