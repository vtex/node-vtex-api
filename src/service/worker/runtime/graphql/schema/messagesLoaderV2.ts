import DataLoader from 'dataloader'
import { sortBy, zip } from 'ramda'

import {
  IndexedByFrom,
  Message,
} from '../../../../../clients/apps/MessagesGraphQL'
import { AppMetaInfo } from '../../../../../clients/infra/Apps'
import { IOClients } from './../../../../../clients/IOClients'
import { KEYWORDS_WILDCARD } from '../../../../../constants'

type Indexed<X> = [number, X]

const sortByContentAndFrom = (indexedMessages: Array<Indexed<Message>>) => sortBy(
  ([_, {content, from}]) => `__from:${from}__content:${content}`,
  indexedMessages
)

// O(n) counting sort implementation
const sortByIndex = (indexedTranslations: Array<Indexed<string>>) => indexedTranslations.reduce(
  (acc, [index, data]) => {
    acc[index] = data
    return acc
  },
  [] as string[]
)

const indexMessagesByFrom = (messages:  Message[]) => messages.reduce(
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
  [] as IndexedByFrom[]
)

const toPairs = <T>(x: T[]) => x.map((xx, it) => [it, xx] as Indexed<T>)

const splitIndex = <T>(indexed: Array<Indexed<T>>) => indexed.reduce(
  (acc, [index, data]) => {
    acc[0].push(index)
    acc[1].push(data)
    return acc
  },
  [[] as number[], [] as T[]] as [number[], T[]]
)

const filterFromEqualsTo = (indexedMessages: Array<Indexed<Message>>, to: string) => indexedMessages.reduce(
  (acc, indexed) => {
    const [index, { content, from }] = indexed
    if (to === from.toLowerCase() || !content) {
      acc.original.push([index, content])
    } else {
      acc.toTranslate.push(indexed)
    }
    return acc
  },
  {
    original: [] as Array<Indexed<string>>,
    toTranslate: [] as Array<Indexed<Message>>,
  }
)

const messageToKey = ({content, context, from}: Message) => `:content:${content}:context:${context}:from:${from}`

const removeKeywordWildcards = (indexedMessages:Array<[number, string]>) => {
  const keywordWildcardIndex = indexedMessages.findIndex(message => message[1] === KEYWORDS_WILDCARD)
  
  if(keywordWildcardIndex < 0) {
    return indexedMessages
  }

  const sanitizedIndexedMessages = indexedMessages.slice(0, keywordWildcardIndex).concat([[keywordWildcardIndex, ""]], indexedMessages.slice(keywordWildcardIndex + 1))
  return sanitizedIndexedMessages
}

export const createMessagesLoader = (
  { messagesGraphQL, assets }: IOClients,
  to: string,
  dependencies?: AppMetaInfo[]
) => {
  const loweredTo = to.toLowerCase()
  const messagesDeps = dependencies && assets.getFilteredDependencies('vtex.messages@1.x', dependencies)
  const depTree = messagesDeps && JSON.stringify(messagesDeps)
  return new DataLoader<Message, string>(
    async messages => {
      const indexedMessages = toPairs(messages)
      const { toTranslate, original } = filterFromEqualsTo(indexedMessages, loweredTo)

      // In case we have nothing to translate
      if (toTranslate.length === 0) {
        return messages.map(({content}) => content)
      }

      const sortedIndexedMessages = sortByContentAndFrom(toTranslate)
      const [ originalIndexes, sortedMessages ] = splitIndex(sortedIndexedMessages)
      const indexedByFrom = indexMessagesByFrom(sortedMessages)

      const args = { indexedByFrom, to }
      const translations = depTree
        ? await messagesGraphQL.translateWithDependencies({ ...args, depTree })
        : await messagesGraphQL.translate(args)

      const indexedTranslations = zip(originalIndexes, translations)
      const allIndexedTranslations = [...removeKeywordWildcards(indexedTranslations), ...original]

      return sortByIndex(allIndexedTranslations)
    },
    {
      batch: true,
      cache: true,
      cacheKeyFn: messageToKey,
      maxBatchSize: 200,
    }
  )
}

export type MessagesLoaderV2 = ReturnType<typeof createMessagesLoader>
