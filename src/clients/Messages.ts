import { InstanceOptions } from '../HttpClient'
import { inflightUrlWithQuery } from '../HttpClient/middlewares/inflight'
import { forWorkspace, IODataSource } from '../IODataSource'
import { IOMessage } from '../service/graphql/schema/typeDefs/ioMessage'
import { IOContext } from '../service/typings'

interface Locale {
  [token: string]: string
}

interface Locales {
  [lang: string]: Locale
}

export class Messages extends IODataSource {
  protected httpClientFactory = forWorkspace
  protected service = 'messages.vtex'

  constructor(vtex: IOContext, options: InstanceOptions) {
    super(vtex, options)
  }

  public translate = (to: string, data: IOMessage[]): Promise<string[]> => this.http.get('/_v/translations', {
    headers: {
      Authorization: this.context!.authToken,
    },
    inflightKey: inflightUrlWithQuery,
    metric: 'messages-translate',
    params: {
      __p: process.env.VTEX_APP_ID,
      data: JSON.stringify(data),
      to,
    },
  })

  public saveTranslation = (data: Locales): Promise<void> => this.http.post('/_v/translations/save', data, {
    headers: {
      Authorization: this.context!.authToken,
    },
    metric: 'messages-save-translation',
    params: {
      __p: process.env.VTEX_APP_ID,
    },
  })
}

