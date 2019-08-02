import { path } from 'ramda'

import { AppGraphQLClient, InstanceOptions } from '../HttpClient'
import { IOContext } from '../service/typings'
import { IOMessage } from '../utils/message'

type IOMessageInput = Pick<
  IOMessage,
  'id' | 'content' | 'description' | 'behavior'
>

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IOMessageSaveInput extends IOMessageInput {
  content: string
}

export interface Translate {
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
  newTranslate: string[]
}

export class MessagesGraphQL extends AppGraphQLClient {
  public constructor(vtex: IOContext, options?: InstanceOptions) {
    super('vtex.messages', vtex, options)
  }

  public translate = async (args: Translate): Promise<string[]> =>
    this.graphql
      .query<TranslateResponse, { args: Translate }>(
        {
          query: `
    query Translate($args: NewTranslateArgs!) {
      newTranslate(args: $args)
    }
    `,
          variables: { args },
        },
        {
          metric: 'messages-translate',
        }
      )
      .then(path(['data', 'newTranslate'])) as Promise<
      TranslateResponse['newTranslate']
    >

  public save = (args: SaveArgs): Promise<boolean> =>
    this.graphql
      .mutate<boolean, { args: SaveArgs }>(
        {
          mutate: `
    mutation Save($args: SaveArgs!) {
      save(args: $args)
    }
    `,
          variables: { args },
        },
        {
          metric: 'messages-save-translation',
        }
      )
      .then(path(['data', 'save'])) as Promise<boolean>
}
