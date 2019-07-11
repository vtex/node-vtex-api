import { map as mapP } from 'bluebird'
import { append, flatten, map, path, pluck, sortBy, toPairs, zip } from 'ramda'

import { AppGraphQLClient, inflightUrlWithQuery, InstanceOptions } from '../HttpClient'
import { IOContext } from '../service/typings'
import { IOMessage } from '../utils/message'

type IOMessageInput = Pick<IOMessage, 'id' | 'content' | 'description' | 'provider'>

export interface IOMessageSaveInput extends IOMessageInput {
  content: string
}

export interface Translate {
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

export class MessagesGraphQL extends AppGraphQLClient {
  constructor(vtex: IOContext, options?: InstanceOptions) {
    super('vtex.messages', vtex, options)
  }

  public translate = async (args: Translate): Promise<string[]> =>
    this.graphql.query<TranslateResponse, { args: Translate }>({
      query: `
      query Translate($args: TranslateArgs!) {
        translate(args: $args)
      }
      `,
      variables: { args },
    }, {
      //inflightKey: inflightUrlWithQuery,
      metric: 'messages-translate',
    }).then(path(['data', 'translate'])) as Promise<TranslateResponse['translate']>

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

}

