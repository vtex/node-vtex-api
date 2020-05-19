import FormData from 'form-data'
import { InstanceOptions, IOContext, UserInputError } from '../..'
import { ExternalClient } from './ExternalClient'

export class MasterData extends ExternalClient {
  public constructor(ctx: IOContext, options?: InstanceOptions) {
    super(`http://api.vtex.com/${ctx.account}/dataentities`, ctx, {
      ...options,
      headers: {
        ...(options && options.headers),
        ...{ Accept: 'application/vnd.vtex.ds.v10+json' },
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }

  private get routes() {
    return {
      attachments: (dataEntity: string, id: string, fields: string) =>
        `${dataEntity}/documents/${id}/${fields}/attachments`,
      document: (dataEntity: string, id: string) => `${dataEntity}/documents/${id}`,
      documents: (dataEntity: string) => `${dataEntity}/documents`,
      publicSchema: (dataEntity: string, schema: string) => `${dataEntity}/schemas/${schema}/public`,
      schema: (dataEntity: string, schema: string) => `${dataEntity}/schemas/${schema}`,
      scroll: (dataEntity: string) => `${dataEntity}/scroll`,
      search: (dataEntity: string) => `${dataEntity}/search`,
    }
  }

  public getSchema = <T>(dataEntity: string, schema: string) =>
    this.http.get<T>(this.routes.schema(dataEntity, schema), {
      metric: 'masterdata-getSchema',
    })

  public getPublicSchema = <T>(dataEntity: string, schema: string) =>
    this.http.get<T>(this.routes.publicSchema(dataEntity, schema), {
      metric: 'masterdata-getPublicSchema',
    })

  public getDocument = <T>(dataEntity: string, id: string, fields: string[]) =>
    this.http.get<T>(this.routes.document(dataEntity, id), {
      metric: 'masterdata-getDocument',
      params: {
        _fields: generateFieldsArg(fields),
      },
    })

  public createDocument = (dataEntity: string, fields: object, schema?: string) =>
    this.http.post<DocumentResponse>(this.routes.documents(dataEntity), fields, {
      metric: 'masterdata-createDocument',
      params: {
        ...(schema ? { _schema: schema } : null),
      },
    })

  public createOrUpdateEntireDocument = (dataEntity: string, fields: object, id?: string, schema?: string) =>
    this.http.put<DocumentResponse>(
      this.routes.documents(dataEntity),
      { id, ...fields },
      {
        metric: 'masterdata-createOrUpdateEntireDocument',
        params: {
          ...(schema ? { _schema: schema } : null),
        },
      }
    )

  public createOrUpdatePartialDocument = (dataEntity: string, fields: object, id?: string, schema?: string) =>
    this.http.patch<DocumentResponse>(
      this.routes.documents(dataEntity),
      { id, ...fields },
      {
        metric: 'masterdata-createOrUpdatePartialDocument',
        params: {
          ...(schema ? { _schema: schema } : null),
        },
      }
    )

  public updateEntireDocument = (dataEntity: string, id: string, fields: object, schema?: string) =>
    this.http.put(this.routes.document(dataEntity, id), fields, {
      metric: 'masterdata-updateEntireDocument',
      params: {
        ...(schema ? { _schema: schema } : null),
      },
    })

  public updatePartialDocument = (dataEntity: string, id: string, fields: object, schema?: string) =>
    this.http.patch(this.routes.document(dataEntity, id), fields, {
      metric: 'masterdata-updatePartialDocument',
      params: {
        ...(schema ? { _schema: schema } : null),
      },
    })

  public searchDocuments = <T>(
    dataEntity: string,
    fields: string[],
    where: string,
    pagination: PaginationArgs,
    schema?: string,
    sort?: string
  ) =>
    this.http.get<T[]>(this.routes.search(dataEntity), {
      headers: paginationArgsToHeaders(pagination),
      metric: 'masterdata-searchDocuments',
      params: {
        _fields: generateFieldsArg(fields),
        _sort: sort,
        _where: where,
        ...(schema ? { _schema: schema } : null),
      },
    })

  public scrollDocuments = <T>(
    dataEntity: string,
    fields: string[],
    pagination: PaginationArgs
  ) => this.http.get(this.routes.scroll(dataEntity), {
    headers: paginationArgsToHeaders(pagination),
    metric: 'masterdata-scrollDocuments',
    params: {
      _fields: generateFieldsArg(fields),
    },
  })

  public deleteDocument = (dataEntity: string, id: string) =>
    this.http.delete(this.routes.document(dataEntity, id), {
      metric: 'masterdata-deleteDocument',
    })

  public uploadAttachment = (dataEntity: string, id: string, fields: string, formData: FormData) =>
    this.http.post<any>(this.routes.attachments(dataEntity, id, fields), formData, {
      headers: formData.getHeaders(),
      metric: 'masterdata-uploadAttachment',
    })
}

function paginationArgsToHeaders({ page, pageSize }: PaginationArgs) {
  if (page < 1) {
    throw new UserInputError('Smallest page value is 1')
  }

  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    'REST-Range': `resources=${startIndex}-${endIndex}`,
  }
}

function generateFieldsArg(fields: string[]) {
  return fields.join(',')
}

interface PaginationArgs {
  page: number
  pageSize: number
}

interface DocumentResponse {
  Id: string
  Href: string
  DocumentId: string
}
