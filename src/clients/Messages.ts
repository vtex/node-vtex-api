import { inflightUrlWithQuery } from '../HttpClient/middlewares/inflight'
import { IOMessage } from '../service/graphql/schema/typeDefs/ioMessage'
import { forWorkspace, IOClientHTTP } from './IOClientHTTP'

interface Locale {
  [token: string]: string
}

interface Locales {
  [lang: string]: Locale
}

export class Messages extends IOClientHTTP {
  protected httpClientFactory = forWorkspace
  protected service = 'messages.vtex'

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

