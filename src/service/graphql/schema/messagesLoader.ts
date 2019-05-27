import { props } from 'bluebird'
import DataLoader from 'dataloader'
import { forEachObjIndexed, mapObjIndexed, pick, repeat } from 'ramda'

import { MessagesGraphQL } from '../../../clients'
import { IOMessage, providerFromMessage } from '../../../utils/message'

export const messagesLoader = (messagesGraphQL: MessagesGraphQL) =>
  new DataLoader<IOMessage, string>(async (messages: IOMessage[]) => {
    const to = messages[0].to!
    const from = messages[0].from
    const behavior = messages[0].behavior
    const messagesByProvider: Record<string, IOMessage[]> = {}
    const indexByProvider: Record<string, number[]> = {}

    messages.forEach((message, index) => {
      const provider = providerFromMessage(message)
      if (!messagesByProvider[provider]) {
        messagesByProvider[provider] = []
        indexByProvider[provider] = []
      }
      messagesByProvider[provider].push(pick(['id', 'content', 'description'], message))
      indexByProvider[provider].push(index)
    })

    const translationsByProvider: Record<string, string[]> = await props(
      mapObjIndexed(
        (messagesArray, provider) =>
          messagesGraphQL.translate({
            behavior,
            from,
            messages: messagesArray,
            provider,
            to,
          }),
        messagesByProvider
      )
    )

    const translations = repeat('', messages.length)
    forEachObjIndexed<string[], Record<string, string[]>>(
      (translationsArray, provider) => {
        const indices = indexByProvider[provider]
        translationsArray.forEach((translation, index) => {
          translations[indices[index]] = translation
        })
      },
      translationsByProvider
    )

    return translations
  })
