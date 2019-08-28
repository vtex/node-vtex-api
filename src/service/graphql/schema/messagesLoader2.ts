import DataLoader from 'dataloader'
import { pluck, sortBy, toPairs, zip } from 'ramda'

import { newMessageInputToNewMessage } from '../../..'
import { IOClients } from '../../../clients/IOClients'
import { IOMessage } from '../../../utils/message'


const sortByContent = (indexedMessages: Array<[string, IOMessage]>) => sortBy(([_, message]) => message.content!, indexedMessages)
const sortByIndex = (indexedTranslations: Array<[string, string]>) => sortBy(([index, _]) => Number(index), indexedTranslations)


export const messagesLoader2 = (clients: IOClients) =>
  new DataLoader<IOMessage, string>(async (messages: IOMessage[]) => {
    const to = messages[0].to!
    const from = messages[0].from
    const indexedMessages = toPairs(messages) as Array<[string, IOMessage]>
    const sortedIndexedMessages = sortByContent(indexedMessages)
    const originalIndexes = pluck(0, sortedIndexedMessages) as string[]
    const sortedMessages = pluck(1, sortedIndexedMessages) as IOMessage[]
    const bla = {
      from,
      messages: newMessageInputToNewMessage(sortedMessages),
      to,
    }
    const translations = await clients.messagesGraphQL.translate2(bla)

    const indexedTranslations = zip(originalIndexes, translations)
    const translationsInOriginalOrder = sortByIndex(indexedTranslations)
    return pluck(1, translationsInOriginalOrder)
  })
