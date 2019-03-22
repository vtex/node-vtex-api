import DataLoader from 'dataloader'
import { append, flatten, map, pluck, prop, sortBy, toPairs, zip } from 'ramda'

import { Logger } from '../../../clients'
import { InstanceOptions } from '../../../HttpClient'
import { forWorkspace, IODataSource } from '../../../IODataSource'
import { IOContext } from '../../typings'
import { IOMessage } from '../schema/typeDefs/ioMessage'

const MAX_QUERYSTRING_LENGTH = 2048

export class MessagesAPI extends IODataSource {
  protected httpClientFactory = forWorkspace
  protected service = 'messages.vtex'

  constructor(vtex: IOContext, options: InstanceOptions, protected logger: Logger) {
    super(vtex, options)
  }

  public translate = (to: string, data: IOMessage[]): Promise<string[]> => this.http.get('/_v/translations', {
    headers: {
      Authorization: this.context!.authToken,
    },
    metric: 'runtime-translate',
    params: {
      __p: process.env.VTEX_APP_ID,
      data: JSON.stringify(data),
      to,
    },
  }).catch(err => {
    this.logger.error(err).catch(console.error)
    return pluck('content', data)
  })
}

const batchData = (lengths: number[], indexedData: IOMessage[]) => {
  let batchedData: IOMessage[][] = []
  let batch: IOMessage[] = []
  let sumLength = 0

  indexedData.forEach((obj: IOMessage, index: number) => {
    const length = lengths[index]
    if (sumLength + length > MAX_QUERYSTRING_LENGTH) {
      batchedData = append(batch, batchedData)
      batch = [obj]
      sumLength = length
    } else {
      sumLength = sumLength + length
      batch = append(obj, batch)
    }
  })

  return append(batch, batchedData)
}

export interface MessagesLoaderArgs {
  messagesAPI: MessagesAPI
  logger: Logger
}

const sortByContent = (indexedData: Array<[string, IOMessage]>) => sortBy(([_, data]) => prop('content', data), indexedData)

const sortByOriginalIndex = (indexedTraslations: Array<[string, string]>) => sortBy(([index, _]) => Number(index), indexedTraslations)

export const messagesLoader = ({messagesAPI, logger}: MessagesLoaderArgs) => new DataLoader<IOMessage, string>(
  async (data: IOMessage[]) => {
    try {
      const to = data[0].to // Should be consistent across batches
      const indexedData = toPairs(data) as Array<[string, IOMessage]>
      const sortedIndexedData = sortByContent(indexedData)
      const originalIndexes = pluck(0, sortedIndexedData) as string[]
      const sortedData = pluck(1, sortedIndexedData) as IOMessage[]
      const strLength = map(obj => JSON.stringify(obj).length, sortedData)
      const batches = batchData(strLength, sortedData)
      const promises = map((batch: IOMessage[]) => !!to ? messagesAPI.translate(to, batch) : Promise.resolve(pluck('content', batch)), batches)
      const translations = await Promise.all(promises).then(res => flatten<string>(res))
      const indexedTranslations = zip(originalIndexes, translations) as Array<[string, string]>
      const translationsInOriginalOrder = sortByOriginalIndex(indexedTranslations)
      return pluck(1, translationsInOriginalOrder)
    }
    catch (err) {
      logger.error(err).catch(console.log)
      return pluck('content', data)
    }
  }
)
