import FormData from 'form-data'
import { InstanceOptions, IOContext, RequestTracingConfig, UserInputError } from '../..'
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

  public getSchema<T>(dataEntity: string, schema: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-getSchema'
    return this.http.get<T>(this.routes.schema(dataEntity, schema), {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public createOrUpdateSchema<T>(
    dataEntity: string,
    schemaName: string,
    schemaBody: object,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-getSchema'
    return this.http.put<T>(this.routes.schema(dataEntity, schemaName), schemaBody, {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getPublicSchema<T>(dataEntity: string, schema: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-getPublicSchema'
    return this.http.get<T>(this.routes.publicSchema(dataEntity, schema), {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getDocument<T>(dataEntity: string, id: string, fields: string[], tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-getDocument'
    return this.http.get<T>(this.routes.document(dataEntity, id), {
      metric,
      params: {
        _fields: generateFieldsArg(fields),
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public createDocument(dataEntity: string, fields: object, schema?: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-createDocument'
    return this.http.post<DocumentResponse>(this.routes.documents(dataEntity), fields, {
      metric,
      params: {
        ...(schema ? { _schema: schema } : null),
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public createOrUpdateEntireDocument(
    dataEntity: string,
    fields: object,
    id?: string,
    schema?: string,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-createOrUpdateEntireDocument'
    return this.http.put<DocumentResponse>(
      this.routes.documents(dataEntity),
      { id, ...fields },
      {
        metric,
        params: {
          ...(schema ? { _schema: schema } : null),
        },
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }
    )
  }

  public createOrUpdatePartialDocument(
    dataEntity: string,
    fields: object,
    id?: string,
    schema?: string,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-createOrUpdatePartialDocument'
    return this.http.patch<DocumentResponse>(
      this.routes.documents(dataEntity),
      { id, ...fields },
      {
        metric,
        params: {
          ...(schema ? { _schema: schema } : null),
        },
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }
    )
  }

  public updateEntireDocument(
    dataEntity: string,
    id: string,
    fields: object,
    schema?: string,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-updateEntireDocument'
    return this.http.put(this.routes.document(dataEntity, id), fields, {
      metric,
      params: {
        ...(schema ? { _schema: schema } : null),
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public updatePartialDocument(
    dataEntity: string,
    id: string,
    fields: object,
    schema?: string,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-updatePartialDocument'
    return this.http.patch(this.routes.document(dataEntity, id), fields, {
      metric,
      params: {
        ...(schema ? { _schema: schema } : null),
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public searchDocuments<T>(
    dataEntity: string,
    fields: string[],
    where: string,
    pagination: PaginationArgs,
    schema?: string,
    sort?: string,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-searchDocuments'
    return this.http.get<T[]>(this.routes.search(dataEntity), {
      headers: paginationArgsToHeaders(pagination),
      metric,
      params: {
        _fields: generateFieldsArg(fields),
        _sort: sort,
        _where: where,
        ...(schema ? { _schema: schema } : null),
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public scrollDocuments<T>(
    dataEntity: string,
    fields: string[],
    pagination: PaginationArgs,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-scrollDocuments'
    return this.http.get<T[]>(this.routes.scroll(dataEntity), {
      headers: paginationArgsToHeaders(pagination),
      metric,
      params: {
        _fields: generateFieldsArg(fields),
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public deleteDocument(dataEntity: string, id: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-deleteDocument'
    return this.http.delete(this.routes.document(dataEntity, id), {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public uploadAttachment(
    dataEntity: string,
    id: string,
    fields: string,
    formData: FormData,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-uploadAttachment'
    return this.http.post<any>(this.routes.attachments(dataEntity, id, fields), formData, {
      headers: formData.getHeaders(),
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }
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
