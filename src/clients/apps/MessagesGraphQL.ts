import { flatten, path, splitEvery, values } from 'ramda'

import { InstanceOptions } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { AppGraphQLClient } from './AppGraphQLClient'

export interface IndexedByFrom {
  messages: Array<Omit<Message, 'from'>>
  from: string
}

export type Behavior = 'FULL' | 'USER_ONLY' | 'USER_AND_APP'

export interface Message {
  content: string
  context?: string
  behavior?: Behavior
  from: string
}

export interface MessageSaveInput {
  srcLang: string
  srcMessage: string
  context?: string
  targetMessage: string
  groupContext?: string
}

export interface TranslateInput {
  indexedByFrom: IndexedByFrom[]
  to: string
  depTree?: string
  encoding?: 'ICU' | 'HANDLEBARS'
}

export interface TranslateWithDependenciesInput {
  indexedByFrom: IndexedByFrom[]
  to: string
  depTree: string
  encoding?: 'ICU' | 'HANDLEBARS'
}

interface TranslatedWithDependencies {
  translateWithDependencies: string[]
}

export interface SaveInput {
  fireEvent?: boolean
  to: string
  messages: MessageSaveInput[]
}

interface TranslatedV2 {
  translate: string[]
}

const MAX_BATCH_SIZE = 500

export class MessagesGraphQL extends AppGraphQLClient {
  constructor(vtex: IOContext, options?: InstanceOptions) {
    super('vtex.messages@1.x', vtex, options)
  }

  public translateV2(args: TranslateInput) {
    const { indexedByFrom, ...rest } = args

    const allMessages: Array<{ from: string; message: Omit<Message, 'from'> }> = indexedByFrom.reduce(
      (acc, { from, messages }) => {
        return acc.concat(messages.map(message => ({ from, message })))
      },
      [] as Array<{ from: string; message: Omit<Message, 'from'> }>
    )

    const batchedMessages = splitEvery(MAX_BATCH_SIZE, allMessages)
    return Promise.all(
      batchedMessages.map(batch => {
        const indexedBatch = batch.reduce((acc, { from, message }) => {
          if (!acc[from]) {
            acc[from] = {
              from,
              messages: [],
            }
          }
          acc[from].messages.push(message)
          return acc
        }, {} as Record<string, IndexedByFrom>)
        const batchArgs = {
          ...rest,
          indexedByFrom: values(indexedBatch),
        }
        return this.graphql
          .query<TranslatedV2, { args: TranslateInput }>(
            {
              query: `
      query Translate($args: TranslateArgs!) {
        translate(args: $args)
      }
      `,
              variables: { args: batchArgs },
            },
            {
              metric: 'messages-translate-v2',
            }
          )
          .then(path(['data', 'translate'])) as Promise<TranslatedV2['translate']>
      })
    ).then(flatten)
  }

  public async translate(args: TranslateInput) {
    const response = await this.graphql.query<TranslatedV2, { args: TranslateInput }>(
      {
        query: `query Translate($args: TranslateArgs!) {
          translate(args: $args)
        }`,
        variables: { args },
      },
      {
        metric: 'messages-translate-v2',
      }
    )
    return response.data!.translate
  }

  public async translateWithDependencies(args: TranslateWithDependenciesInput) {
    const response = await this.graphql.query<TranslatedWithDependencies, { args: TranslateWithDependenciesInput }>(
      {
        query: `query TranslateWithDeps($args: TranslateWithDependenciesArgs!) {
          translateWithDependencies(args: $args)
        }`,
        variables: { args },
      },
      {
        metric: 'messages-translate-with-deps-v2',
      }
    )
    return response.data!.translateWithDependencies
  }

  public async saveV2(args: SaveInput) {
    const response = await this.graphql.mutate<{ saveV2: boolean }, { args: SaveInput }>(
      {
        mutate: `mutation SaveV2($args: SaveArgsV2!) {
          saveV2(args: $args)
        }`,
        variables: { args },
      },
      {
        metric: 'messages-saveV2-translation',
      }
    )
    return response.data!.saveV2
  }
}
