import DataLoader from 'dataloader'
import { map, pluck, sortBy, toPairs, zip } from 'ramda'

import { IOClients } from '../../../clients/IOClients'
import { IOMessageInputV2, IOMessageV2 } from './../../../clients/MessagesGraphQL'

const sortByContent = (indexedMessages: Array<[string, IOMessageV2]>) => sortBy(([_, message]) => message.content!, indexedMessages)
const sortByIndex = (indexedTranslations: Array<[string, string]>) => sortBy(([index, _]) => Number(index), indexedTranslations)

const toInput = (
  messages: IOMessageV2[]
): IOMessageInputV2[] =>
  map(
    (message) => ({
      behavior: message.behavior,
      content: message.content,
      context: message.context,
    }),
    messages
  )

export const messagesLoaderV2 = (clients: IOClients) =>
  new DataLoader<IOMessageV2, string>(async (messages: IOMessageV2[]) => {
    const to = messages[0].to!
    const from = messages[0].from
    const indexedMessages = toPairs(messages) as Array<[string, IOMessageV2]>
    const sortedIndexedMessages = sortByContent(indexedMessages)
    const originalIndexes = pluck(0, sortedIndexedMessages) as string[]
    const sortedMessages = pluck(1, sortedIndexedMessages) as IOMessageV2[]
    const translations = await clients.messagesGraphQL.translateV2({
      from,
      messages: toInput(sortedMessages),
      to,
    })
    const indexedTranslations = zip(originalIndexes, translations)
    const translationsInOriginalOrder = sortByIndex(indexedTranslations)
    return pluck(1, translationsInOriginalOrder)
  })
