import { map as mapP } from 'bluebird'
import { append, flatten, map, path, pluck, sortBy, toPairs, zip } from 'ramda'

import { AppGraphQLClient, inflightUrlWithQuery, InstanceOptions } from '../HttpClient'
import { IOContext } from '../service/typings'
import { IOMessage, removeProviderFromId } from '../utils/message'

type IOMessageInput = Pick<IOMessage, 'id' | 'content' | 'description'>

export interface IOMessageSaveInput extends IOMessageInput {
  content: string
}

export interface Translate {
  provider: string
  messages: IOMessageInput[]
  from?: string
  to: string
}

export interface SaveArgs {
  to: string
  messagesByProvider: Array<{
    messages: IOMessageSaveInput[]
    provider: string
  }>
}

interface TranslateResponse {
  translate: string[]
}

const MAX_QUERYSTRING_LENGTH = 1548

const sortById = (indexedMessages: Array<[string, IOMessageInput]>) => sortBy(([, {id}]) => id, indexedMessages)

const sortByIndex = (indexedTranslations: Array<[string, string]>) => sortBy(([index, _]) => Number(index), indexedTranslations)

const batchData = (lengths: number[], indexedData: IOMessageInput[]) => {
  let batchedData: IOMessageInput[][] = []
  let batch: IOMessageInput[] = []
  let sumLength = 0

  indexedData.forEach((obj: IOMessageInput, index: number) => {
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

export class MessagesGraphQL extends AppGraphQLClient {
  constructor(vtex: IOContext, options?: InstanceOptions) {
    super('vtex.messages', vtex, options)
  }

  public translate = async (args: Translate): Promise<string[]> => {
    const { messages } = args
    const indexedMessages = toPairs(messages) as Array<[string, IOMessageInput]>
    const sortedIndexedMessages = sortById(indexedMessages)
    const originalIndexes = pluck(0, sortedIndexedMessages) as string[]
    const sortedMessages = pluck(1, sortedIndexedMessages) as IOMessageInput[]
    const strLength = map(obj => JSON.stringify(obj).length, sortedMessages)
    const batches = batchData(strLength, sortedMessages)
    const translations = await mapP(
      batches,
      batch => this.doTranslate({
        ...args,
        messages: batch,
      })
    ).then(flatten)
    const indexedTranslations = zip(originalIndexes, translations) as Array<[string, string]>
    const translationsInOriginalOrder = sortByIndex(indexedTranslations)
    return pluck(1, translationsInOriginalOrder)
  }

  public save = (args: SaveArgs): Promise<boolean> => this.graphql.mutate<boolean, { args: SaveArgs }>({
    mutate: `
    mutation Save($args: SaveArgs!) {
      save(args: $args)
    }
    `,
    variables: { args },
  }, {
    metric: 'messages-save-translation',
  }).then(path(['data', 'save'])) as Promise<boolean>

  private doTranslate = (args: Translate) =>
    this.graphql.query<TranslateResponse, { args: Translate }>({
      query: `
      query Translate($args: TranslateArgs!) {
        translate(args: $args)
      }
      `,
      useGet: true,
      variables: {
        args: {
          ...args,
          messages: map(removeProviderFromId, args.messages),
        },
      },
    }, {
      inflightKey: inflightUrlWithQuery,
      metric: 'messages-translate',
    })
    .then(path(['data', 'translate'])) as Promise<TranslateResponse['translate']>
}

