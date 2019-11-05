import { path } from 'ramda'

import { AppGraphQLClient, InstanceOptions } from '../HttpClient'
import { IOContext } from '../service/typings'
import { IOMessage } from '../utils/message'

type IOMessageInput = Pick<IOMessage, 'id' | 'content' | 'description' | 'behavior'>

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

interface MessagesInput {
  provider: string,
  messages: IOMessageInput[],
}

export interface IOMessageSaveInput extends IOMessageInput {
  content: string
}

export interface MessageSaveInputV2 {
  srcLang: string
  srcMessage: string
  context?: string
  targetMessage: string
  groupContext?: string
}

export interface Translate {
  messages: MessagesInput[]
  from?: string
  to: string
}

export interface TranslateInputV2 {
  indexedByFrom: IndexedMessageV2[]
  to: string
}

export interface SaveArgs {
  to: string
  messagesByProvider: Array<{
    messages: IOMessageSaveInput[]
    provider: string
  }>
}

export interface SaveArgsV2 {
  to: string
  messages: MessageSaveInputV2[]
}

interface TranslateResponse {
  newTranslate: string[]
}

interface TranslatedV2 {
  translate: string[]
}

export class MessagesGraphQL extends AppGraphQLClient {
  constructor(vtex: IOContext, options?: InstanceOptions) {
    super('vtex.messages@1.x', vtex, options)
  }

  public translate = async (args: Translate): Promise<string[]> => this.graphql.query<TranslateResponse, { args: Translate }>({
    query: `
    query Translate($args: NewTranslateArgs!) {
      newTranslate(args: $args)
    }
    `,
    variables: { args },
  }, {
    metric: 'messages-translate',
  }).then(path(['data', 'newTranslate'])) as Promise<TranslateResponse['newTranslate']>

  public translateV2 = (args: TranslateInputV2) => this.graphql.query<TranslatedV2, { args: TranslateInputV2 }>({
      query: `
      query Translate($args: TranslateArgs!) {
        translate(args: $args)
      }
      `,
      variables: { args },
    }, {
      metric: 'messages-translate-v2',
    }).then(path(['data', 'translate'])) as Promise<TranslatedV2['translate']>

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

  public saveV2 = (args: SaveArgsV2): Promise<boolean> => this.graphql.mutate<boolean, { args: SaveArgsV2 }>({
    mutate: `
    mutation SaveV2($args: SaveArgsV2!) {
      saveV2(args: $args)
    }
    `,
    variables: { args },
  }, {
    metric: 'messages-saveV2-translation',
  }).then(path(['data', 'saveV2'])) as Promise<boolean>

}

