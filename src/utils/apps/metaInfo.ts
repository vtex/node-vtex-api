import crypto from 'crypto'

import { AppMetaInfo, Apps, IOContext } from '../..'
import { CacheLayer } from '../../caches'
import { Logger } from '../../service/logger'

const getKey = (account: string) => `${account}-meta-infos`

const hashMD5 = (text: string) =>
  crypto
    .createHash('md5')
    .update(text)
    .digest('hex')

const updateCache = async (cacheStorage: CacheLayer<string, AppMetaInfo[]>, account: string, workspace: string, dependencies: AppMetaInfo[], logger: Logger) => {
  if (workspace !== 'fox') {
    return
  }
  const key = getKey(account)
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

export const getAppsMetaInfo = async (apps: Apps, ioContext: IOContext, cacheStorage: CacheLayer<string, AppMetaInfo[]>): Promise<AppMetaInfo[]> => {
  const { account, workspace, logger } = ioContext
  try {
    const dependencies = await apps.getAppsMetaInfos()
    updateCache(cacheStorage, account, workspace, dependencies, logger)
    return dependencies
  } catch (error) {
    if (workspace !== 'fox') {
      return []
    }
    return await cacheStorage.get(getKey(account)) || []
  }
}
