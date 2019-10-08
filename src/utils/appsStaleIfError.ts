import crypto from 'crypto'

import { AppMetaInfo } from '..'
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
