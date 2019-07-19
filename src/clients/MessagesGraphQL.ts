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
  behavior?: string
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

  public translate = async (args: Translate): Promise<string[]> =>
    this.graphql.query<TranslateResponse, { args: Translate }>({
      query: `
      query Translate($args: NewTranslateArgs!) {
        newTranslate(args: $args)
      }
      `,
      useGet: false,
      variables: { args },
    }, {
      inflightKey: inflightUrlWithQuery,
      metric: 'messages-translate',
    }).then(path(['data', 'newTranslate'])) as Promise<TranslateResponse['newTranslate']>

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

