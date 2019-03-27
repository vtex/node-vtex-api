import DataLoader from 'dataloader'
import { append, flatten, map, pluck, prop, sortBy, toPairs, zip } from 'ramda'

import { Messages } from '../../../clients'
import { IOMessage } from '../schema/typeDefs/ioMessage'

const MAX_QUERYSTRING_LENGTH = 2048

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

const sortByContent = (indexedData: Array<[string, IOMessage]>) => sortBy(([_, data]) => prop('content', data), indexedData)

const sortByOriginalIndex = (indexedTraslations: Array<[string, string]>) => sortBy(([index, _]) => Number(index), indexedTraslations)

export const messagesLoader = (messagesAPI: Messages) => new DataLoader<IOMessage, string>(
  async (data: IOMessage[]) => {
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
)
