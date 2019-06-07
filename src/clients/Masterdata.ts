import {IncomingMessage} from 'http'
import mime from 'mime-types'
import {basename} from 'path'
import {Readable} from 'stream'
import {createGzip} from 'zlib'

import {inflightURL, inflightUrlWithQuery, InfraClient, InstanceOptions} from '../HttpClient'
import {IgnoreNotFoundRequestConfig} from '../HttpClient/middlewares/notFound'
import {BucketMetadata, FileListItem} from '../responses'
import {IOContext} from '../service/typings'

const appId = process.env.VTEX_APP_ID
const [runningAppName] = appId ? appId.split('@') : ['']

const routes = {
  Document: (dataEntity: string, id: string) => `${routes.Documents(dataEntity)}/${id}`,
  Documents: (dataEntity: string) => `dataentities/${dataEntity}/documents`,
  Search: (dataEntity: string) => `${routes.Documents(dataEntity)}/search`,
}



// TODO Types nos returns dos https
export class Masterdata extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('masterdata', context, options)
    if (runningAppName === '') {
      throw new Error(`Invalid path to access VBase. Variable VTEX_APP_ID is not available.`)
    }
  }

  public createDocument = <T>(dataEntity: string, data: T) =>
    this.http.post(routes.Documents(dataEntity), data, this.getJSONConfig('masterdata-create-doc')) // TODO Definir o que será isso aqui


  public upsertDocument = <T>(dataEntity: string, data: T) =>
    this.http.patch(routes.Documents(dataEntity), data, this.getJSONConfig('masterdata-upsert-doc'))

  /**
   * @param dataEntity
   * @param id
   * @param fields Assign the fields parameter in the parameters to retrieve the desired fields. Send ["_all"] if all fields are desired
   */
  public getDocument = <T>(dataEntity: string, id: string, fields: string[]) =>
      this.http.get(routes.Document(dataEntity, id), {params: {_fields: fields.join(',')}})

  public updateDocument = <T>(dataEntity: string, id: string, data: T) =>
      this.http.put(routes.Document(dataEntity, id), data, this.getJSONConfig('masterdata-updata-doc'))

  public deleteDocument = <T>(dataEntity: string, id: string, data: T) =>
      this.http.delete(routes.Document(dataEntity, id))

  public searchDocument = <T>(
    dataEntity: string,
    fields: string[],
    where?: string,
    schema?: string,
    keyword?: string,
    sort?: string,
    range?: RestRange) => {
      const searchConfig = {
        'REST-Range': (range? `resources=${range.start}-${range.end}` : undefined),
        params: {
          _fields: fields.join(','),
          _keyword: keyword,
          _schema: schema,
          _sort: sort,
          _where: where,
        },
      }

      return this.http.get(routes.Search(dataEntity), searchConfig)
  }

  public uploadAttachment = (
    acronym: string,
    id: string,
    fields: string,
    formData: FormData
  ) =>
    this.http.post<any>(routes.Attachments(data, id, fields), formData, {
      headers: formData.getHeaders(),
      metric: 'masterdata-uploadAttachment',
  })

  private getJSONConfig = (metric: string) => {
    return {
      headers: {'Content-Type': 'application/json'},
      metric,
    }
  }
}

interface RestRange {
  start: number,
  end: number,
}
