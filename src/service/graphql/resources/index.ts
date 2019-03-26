import * as DataLoader from 'dataloader'

import { LRUCache } from '../../../caches/LRUCache'
import { Cached } from '../../../HttpClient/middlewares/cache'
import { isNetworkErrorOrRouterTimeout } from '../../../utils/retry'
import { ServiceContext } from '../../typings'
import { IOMessage } from '../schema/typeDefs/ioMessage'
import { MessagesAPI, messagesLoader } from './messages'
import { SegmentAPI } from './segment'

const cacheStorage = new LRUCache<string, Cached>({
  max: 2000,
})

if (global.metrics) {
  global.metrics.trackCache('runtime-segment', cacheStorage)
}

// Retry on timeout from our end
const isAborted = (e: any) => {
  if (e && e.code === 'ECONNABORTED') {
    return true
  }
  return isNetworkErrorOrRouterTimeout(e)
}

const TWO_SECONDS_MS =  2 * 1000
const TEN_SECONDS_MS = 10 * 1000
const retryConfig = {
  retries: 1,
  retryCondition: isAborted,
  shouldResetTimeout: true,
}

export class Resources {
  public messagesAPI: MessagesAPI
  public segmentAPI: SegmentAPI
  public translationsLoader: DataLoader<IOMessage, string>

  constructor (ctx: ServiceContext) {
    const {vtex} = ctx
    const metrics = global.metrics

    this.segmentAPI = new SegmentAPI(vtex, {memoryCache: cacheStorage, timeout: TWO_SECONDS_MS, retryConfig, metrics}, ctx.clients.logger)
    this.messagesAPI = new MessagesAPI(vtex, {timeout: TEN_SECONDS_MS, retryConfig, metrics}, ctx.clients.logger)
    this.translationsLoader = messagesLoader(this.messagesAPI)
  }
}
