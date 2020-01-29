import { splitEvery } from 'ramda'

import { InstanceOptions } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { AppGraphQLClient } from './AppGraphQLClient'

export interface IndexedMessageV2 {
  messages: IOMessageInputV2[]
  from: string
}

export interface IOMessageInputV2 {
  content: string
  context?: string
  behavior?: Behavior
}

export type Behavior = 'FULL' | 'USER_ONLY' | 'USER_AND_APP'

export interface IOMessageV2 extends IOMessageInputV2 {
  from: string
  to: string
}

export interface MessageSaveInputV2 {
  srcLang: string
  srcMessage: string
  context?: string
  targetMessage: string
  groupContext?: string
}

export interface TranslateInputV2 {
  indexedByFrom: IndexedMessageV2[]
  to: string
  depTree?: string
  encoding: 'ICU' | 'HANDLEBARS'
}

export interface TranslateWithDependenciesInput {
  indexedByFrom: IndexedMessageV2[]
  to: string
  depTree: string
  encoding: 'ICU' | 'HANDLEBARS'
}

interface TranslatedWithDependencies {
  translateWithDependencies: string[]
}

export interface SaveArgsV2 {
  fireEvent?: boolean
  to: string
  messages: MessageSaveInputV2[]
}

interface TranslatedV2 {
  translate: string[]
}

interface SaveV2 {
  saveV2: boolean
}

const MAX_BATCH_SIZE = 500

const batchMessages = (batchSize: number, messagesByFrom: IndexedMessageV2[]) => {
  const messagesWithFrom = messagesByFrom.flatMap(
    ({from, messages}) => messages.map(message => ({from, message}))
  )
  const splitted = splitEvery(batchSize, messagesWithFrom)
  const batchedMessagesByFrom = splitted.map(batch => {
    const fromIndices = {} as Record<string, number>
    return batch.reduce(
      (acc, {from, message}) => {
        if (!fromIndices[from]) {
          fromIndices[from] = acc.length
          acc.push({
            from,
            messages: [],
          })
        }
        acc[fromIndices[from]].messages.push(message)
        return acc
      },
      [] as IndexedMessageV2[]
    )
  })
  return batchedMessagesByFrom
}

export class MessagesGraphQL extends AppGraphQLClient {
  constructor(vtex: IOContext, options?: InstanceOptions) {
    super('vtex.messages@1.x', vtex, options)
  }

  public async translateV2 (args: TranslateInputV2) {
    const { indexedByFrom, ...rest } = args
    const batched = batchMessages(MAX_BATCH_SIZE, indexedByFrom)
    const translations = await Promise.all(batched.map(batch =>
      this.graphql.query<TranslatedV2, { args: TranslateInputV2 }>({
        query: `query Translate($args: TranslateArgs!) {
          translate(args: $args)
        }`,
        variables: {
          args: {
            ...rest,
            indexedByFrom: batch,
          },
        },
      }, {
        metric: 'messages-translate-v2',
      })
      .then(response => response.data!.translate)
    ))
    return translations.flat()
  }

  public async translateWithDependencies (args: TranslateWithDependenciesInput) {
    const { indexedByFrom, ...rest } = args
    const batched = batchMessages(MAX_BATCH_SIZE, indexedByFrom)
    const translations = await Promise.all(batched.map(batch =>
      this.graphql.query<TranslatedWithDependencies, { args: TranslateWithDependenciesInput }>({
        query: `
          query TranslateWithDeps($args: TranslateWithDependenciesArgs!) {
            translateWithDependencies(args: $args)
          }
        `,
        variables: {
          args: {
            ...rest,
            indexedByFrom: batch,
          },
        },
      }, {
        metric: 'messages-translate-v2',
      })
      .then(response => response.data!.translateWithDependencies)
    ))
    return translations.flat()
  }

  public saveV2 = (args: SaveArgsV2) => this.graphql.mutate<SaveV2, { args: SaveArgsV2 }>({
    mutate: `
    mutation SaveV2($args: SaveArgsV2!) {
      saveV2(args: $args)
    }
    `,
    variables: { args },
  }, {
    metric: 'messages-saveV2-translation',
  }).then(response => response.data!.saveV2)
}
