import { props } from 'bluebird'
import DataLoader from 'dataloader'
import { forEachObjIndexed, mapObjIndexed, pick, repeat } from 'ramda'

import { IOClients } from '../../../clients/IOClients'
import { IOMessage, providerFromMessage } from '../../../utils/message'

export const messagesLoader = (clients: IOClients) =>
  new DataLoader<IOMessage, string>(async (messages: IOMessage[]) => {
    const to = messages[0].to!
    const from = messages[0].from
    const behavior = messages[0].behavior
    const messagesByProvider: Record<string, IOMessage[]> = {}
    const indexByProvider: Record<string, number[]> = {}

    messages.forEach((message, index) => {
      message.provider = providerFromMessage(message)
      delete message.from
      delete message.to
    })

    const translations = await clients.messagesGraphQL.translate({
        behavior,
        from,
        messages,
        to
      })

    console.log(`The translatons are: ` + JSON.stringify(translations, null,2 ))
    return translations
  })
