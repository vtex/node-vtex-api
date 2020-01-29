import DataLoader from 'dataloader'
import { pluck, sortBy, toPairs, zip } from 'ramda'

import {
  IndexedMessageV2,
  IOMessageV2,
} from '../../../../../clients/apps/MessagesGraphQL'
import { IOClients } from '../../../../../clients/IOClients'

const sortByContentAndFrom = (indexedMessages: Array<[string, IOMessageV2]>) => sortBy(
  ([_, {content, from}]) => `__from:${from}__content:${content}`,
  indexedMessages
)

const sortByIndex = (indexedTranslations: Array<[string, string]>) => sortBy(([index, _]) => Number(index), indexedTranslations)

const indexMessagesByFrom = (messages: IOMessageV2[]) => messages.reduce(
  (acc, {from, context, content, behavior}) => {
    const lastIndexed = acc.length && acc[acc.length-1]
    const formatted = {
      behavior,
      content,
      context,
    }
    if (lastIndexed && lastIndexed.from === from) {
      lastIndexed.messages.push(formatted)
    } else {
      acc.push({
        from,
        messages: [formatted],
      })
    }
    return acc
  },
  [] as IndexedMessageV2[]
)

export const messagesLoaderV2 = (clients: IOClients, withAppsMetaInfo?: boolean) =>
  new DataLoader<IOMessageV2, string>(async (messages: IOMessageV2[]) => {
    const to = messages[0].to!
    const indexedMessages = toPairs(messages) as Array<[string, IOMessageV2]>
    const sortedIndexedMessages = sortByContentAndFrom(indexedMessages)
    const originalIndexes = pluck(0, sortedIndexedMessages) as string[]
    const sortedMessages = pluck(1, sortedIndexedMessages) as IOMessageV2[]
    const indexedByFrom = indexMessagesByFrom(sortedMessages)
    const depTree = withAppsMetaInfo ? JSON.stringify(await clients.apps.getAppsMetaInfos()) : ''
    const translations = await clients.messagesGraphQL.translateV2({
      depTree,
      encoding: 'ICU',
      indexedByFrom,
      to,
    })
    const indexedTranslations = zip(originalIndexes, translations)
    const translationsInOriginalOrder = sortByIndex(indexedTranslations)
    return pluck(1, translationsInOriginalOrder)
  })

export type MessagesLoaderV2 = ReturnType<typeof messagesLoaderV2>
