import { flatten, path, splitEvery, values } from 'ramda'

import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
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

export interface MessageInputV2 {
  content: string
  context?: string
  behavior?: Behavior
}

export interface MessageListV2 {
  srcLang: string
  groupContext?: string
  context?: string
  translations: Translation[]
}

export interface Translation {
  lang: string
  translation: string
}

const MAX_BATCH_SIZE = 500

export class MessagesGraphQL extends AppGraphQLClient {
  constructor(vtex: IOContext, options?: InstanceOptions) {
    super('vtex.messages@1.63.0-beta.1', vtex, options)
  }

  public translateV2 (args: TranslateInput, tracingConfig?: RequestTracingConfig) {
    const { indexedByFrom, ...rest } = args

    const allMessages: Array<{from: string, message: Omit<Message, 'from'>}> = indexedByFrom.reduce((acc, {from, messages}) => {
      return acc.concat(messages.map(message => ({from, message})))
    }, [] as Array<{from: string, message: Omit<Message, 'from'>}>)

    const batchedMessages = splitEvery(MAX_BATCH_SIZE, allMessages)
    const metric = 'messages-translate-v2'
    return Promise.all(batchedMessages.map(batch => {
      const indexedBatch = batch.reduce((acc, {from, message}) => {
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
      return this.graphql.query<TranslatedV2, { args: TranslateInput }>({
        query: `
      query Translate($args: TranslateArgs!) {
        translate(args: $args)
      }
      `,
        variables: { args: batchArgs },
      }, {
        metric,
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }).then(path(['data', 'translate'])) as Promise<TranslatedV2['translate']>
    })).then(flatten)
  }

  public async translate (args: TranslateInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'messages-translate-v2'
    const response = await this.graphql.query<TranslatedV2, { args: TranslateInput }>(
      {
        query: `query Translate($args: TranslateArgs!) {
          translate(args: $args)
        }`,
        variables: { args },
      },
      {
        metric,
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }
    )
    return response.data!.translate
  }

  public async translateWithDependencies (args: TranslateWithDependenciesInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'messages-translate-with-deps-v2'
    const response = await this.graphql.query<TranslatedWithDependencies, { args: TranslateWithDependenciesInput }>(
      {
        query: `query TranslateWithDeps($args: TranslateWithDependenciesArgs!) {
          translateWithDependencies(args: $args)
        }`,
        variables: { args },
      },
      {
        metric,
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }
    )
    return response.data!.translateWithDependencies
  }


  public async saveV2 (args: SaveInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'messages-saveV2-translation'
    const response = await this.graphql.mutate<{ saveV2: boolean }, { args: SaveInput }>(
      {
        mutate: `mutation SaveV2($args: SaveArgsV2!) {
          saveV2(args: $args)
        }`,
        variables: { args },
      },
      {
        metric,
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }
    )
    return response.data!.saveV2
  }

  public async userTranslations (args: IndexedByFrom, tracingConfig?: RequestTracingConfig) {
    const metric = 'messages-user-translations'
    const response = await this.graphql.query<{ userTranslations: MessageListV2[] }, { args: IndexedByFrom }>(
      {
        query: `query UserTranslations($args: IndexedMessages!){
          userTranslations(args: $args) {
            srcLang
            groupContext
            context
            translations {
              lang
              translation
            }
          }
        }`,
        variables: { args },
      },
      {
        metric,
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }
    )
    return response.data!.userTranslations
  }
}

