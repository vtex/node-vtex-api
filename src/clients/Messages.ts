import { AppClient, inflightUrlWithQuery, InstanceOptions } from '../HttpClient'
import { IOMessage } from '../service/graphql/schema/typeDefs/ioMessage'
import { IOContext } from '../service/typings'

interface Locale {
  [token: string]: string
}

interface Locales {
  [lang: string]: Locale
}

export class Messages extends AppClient {
  constructor(vtex: IOContext, options: InstanceOptions) {
    super('vtex.messages', vtex, options)
  }

  public translate = (to: string, data: IOMessage[]): Promise<string[]> => this.http.get('/_v/translations', {
    inflightKey: inflightUrlWithQuery,
    metric: 'messages-translate',
    params: {
      data: JSON.stringify(data),
      to,
    },
  })

  public saveTranslation = (data: Locales): Promise<void> => this.http.post('/_v/translations/save', data, {
    metric: 'messages-save-translation',
  })
}
