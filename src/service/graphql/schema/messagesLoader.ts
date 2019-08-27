import DataLoader from 'dataloader'
import { compose, map, mapObjIndexed, pick, pluck, sortBy, toPairs, values, zip } from 'ramda'

import { IOClients } from '../../../clients/IOClients'
import { IOMessage, providerFromMessage, removeProviderFromId } from '../../../utils/message'

const sortByProvider = (indexedMessages: Array<[string, IOMessage]>) => sortBy(([_, message]) => providerFromMessage(message), indexedMessages)
const sortByContent = (indexedMessages: Array<[string, IOMessage]>) => sortBy(([_, message]) => message.content!, indexedMessages)

const sortByIndex = (indexedTranslations: Array<[string, string]>) => sortBy(([index, _]) => Number(index), indexedTranslations)

export const messagesLoader = (clients: IOClients) =>
  new DataLoader<IOMessage, string>(async (messages: IOMessage[]) => {
    const to = messages[0].to!
    const from = messages[0].from
    const indexedMessages = toPairs(messages) as Array<[string, IOMessage]>
    const sortedIndexedMessages = sortByProvider(indexedMessages)
    const originalIndexes = pluck(0, sortedIndexedMessages) as string[]
    const sortedMessages = pluck(1, sortedIndexedMessages) as IOMessage[]
    const messagesByProvider: Record<string, IOMessage[]> = {}
    const indexByProvider: Record<string, number[]> = {}

    sortedMessages.forEach((message, index) => {
      const provider = providerFromMessage(message)
      if (!messagesByProvider[provider]) {
        messagesByProvider[provider] = []

        indexByProvider[provider] = []
      }
      messagesByProvider[provider].push(pick(['id', 'content', 'description', 'behavior'], message))
      indexByProvider[provider].push(index)
    })

    const messagesInput = compose(
      values,
      mapObjIndexed(
        (messagesArray, provider) => ({
          messages: map(removeProviderFromId, messagesArray),
          provider,
        })
      )
    )(messagesByProvider)

    const translations = await clients.messagesGraphQL.translate({
      from,
      messages: messagesInput,
      to,
    })

    const indexedTranslations = zip(originalIndexes, translations)
    const translationsInOriginalOrder = sortByIndex(indexedTranslations)
    return pluck(1, translationsInOriginalOrder)
  })

  export const messagesLoader2 = (clients: IOClients) =>
  new DataLoader<IOMessage, string>(async (messages: IOMessage[]) => {
    const to = messages[0].to!
    const from = messages[0].from
    const indexedMessages = toPairs(messages) as Array<[string, IOMessage]>
    const sortedIndexedMessages = sortByContent(indexedMessages)
    const originalIndexes = pluck(0, sortedIndexedMessages) as string[]
    const sortedMessages = pluck(1, sortedIndexedMessages) as IOMessage[]

    const translations = await clients.messagesGraphQL.translate2({
      from,
      messages: sortedMessages,
      to,
    })

    const indexedTranslations = zip(originalIndexes, translations)
    const translationsInOriginalOrder = sortByIndex(indexedTranslations)
    return pluck(1, translationsInOriginalOrder)
  })
