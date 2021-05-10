import { InstanceOptions, IOContext, RequestTracingConfig, UserInputError } from '../..'
import { ExternalClient } from './ExternalClient'

const routes = {
  document: (dataEntity: string, id: string) => `${dataEntity}/documents/${id}`,
  documents: (dataEntity: string) => `${dataEntity}/documents`,
  publicSchema: (dataEntity: string, schema: string) => `${dataEntity}/schemas/${schema}/public`,
  schema: (dataEntity: string, schema: string) => `${dataEntity}/schemas/${schema}`,
  aggregations: (dataEntity: string) => `${dataEntity}/aggregations`,
  scroll: (dataEntity: string) => `${dataEntity}/scroll`,
  search: (dataEntity: string) => `${dataEntity}/search`,
}

export class MasterData extends ExternalClient {
  public constructor(ctx: IOContext, options?: InstanceOptions) {
    super(`http://api.vtex.com/api/dataentities`, ctx, {
      ...options,
      headers: {
        Accept: 'application/json',
        VtexIdclientAutCookie: ctx.authToken,
        'x-vtex-api-appService': ctx.userAgent,
        ...options?.headers,
      },
      params: {
        an: ctx.account,
        ...options?.params,
      },
    })
  }

  public getSchema<T>({ dataEntity, schema }: GetSchemaInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-getSchema'
    return this.http.get<T>(routes.schema(dataEntity, schema), {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public aggregate(
    {
      dataEntity,
      field: _field,
      type: _type,
      cumulative: _cumulative,
      derivative: _derivative,
      where: _where,
      interval: _interval,
      schema: _schema,
    }: AggregationInput,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-getSchema'
    return this.http.get<AggregationResult>(routes.aggregations(dataEntity), {
      metric,
      params: {
        _schema,
        _where,
        _interval,
        _derivative,
        _cumulative,
        _type,
        _field,
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public createOrUpdateSchema<T>(
    { dataEntity, schemaName, schemaBody }: CreateSchemaInput,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-createOrUpdateSchema'
    return this.http.put<T>(routes.schema(dataEntity, schemaName), schemaBody, {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getPublicSchema<T>({ dataEntity, schema }: GetSchemaInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-getPublicSchema'
    return this.http.get<T>(routes.publicSchema(dataEntity, schema), {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getDocument<T>({ dataEntity, id, fields }: GetDocumentInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-getDocument'
    return this.http.get<T>(routes.document(dataEntity, id), {
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

  public createDocument({ dataEntity, fields, schema }: CreateDocumentInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-createDocument'
    return this.http.post<DocumentResponse>(routes.documents(dataEntity), fields, {
      metric,
      params: {
        _schema: schema,
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public createOrUpdateEntireDocument(
    { dataEntity, fields, id, schema }: CreateOrUpdateInput,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-createOrUpdateEntireDocument'
    return this.http.put<DocumentResponse>(
      routes.documents(dataEntity),
      { id, ...fields },
      {
        metric,
        params: {
          _schema: schema,
        },
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }
    )
  }

  public createOrUpdatePartialDocument(
    { dataEntity, fields, id, schema }: CreateOrUpdateInput,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-createOrUpdatePartialDocument'
    return this.http.patch<DocumentResponse>(
      routes.documents(dataEntity),
      { id, ...fields },
      {
        metric,
        params: {
          _schema: schema,
        },
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }
    )
  }

  public updateEntireDocument({ dataEntity, id, fields, schema }: UpdateInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-updateEntireDocument'
    return this.http.put(routes.document(dataEntity, id), fields, {
      metric,
      params: {
        _schema: schema,
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public updatePartialDocument({ dataEntity, id, fields, schema }: UpdateInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-updatePartialDocument'
    return this.http.patch(routes.document(dataEntity, id), fields, {
      metric,
      params: {
        _schema: schema,
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public searchDocuments<T>(
    { dataEntity, fields, where, pagination, schema, sort }: SearchInput,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-searchDocuments'
    return this.http.get<T[]>(routes.search(dataEntity), {
      headers: paginationArgsToHeaders(pagination),
      metric,
      params: {
        _fields: generateFieldsArg(fields),
        _schema: schema,
        _sort: sort,
        _where: where,
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public async searchDocumentsWithPaginationInfo<T>(
    { dataEntity, fields, where, pagination, schema, sort }: SearchInput,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-searchDocumentsWithPagination'
    const result = await this.http.getRaw<T[]>(routes.search(dataEntity), {
      headers: paginationArgsToHeaders(pagination),
      metric,
      params: {
        _fields: generateFieldsArg(fields),
        _schema: schema,
        _sort: sort,
        _where: where,
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
    const headers = result.headers
    const restContentRange = headers['rest-content-range']
    const total = Number(restContentRange.split('/')[1])
    const paginationInfo = { ...pagination, total }
    return { data: result.data, pagination: paginationInfo }
  }

  public scrollDocuments<T>(
    { dataEntity, fields, mdToken, schema, size, sort }: ScrollInput,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = 'masterdata-scrollDocuments'
    return this.http
      .getRaw<ScrollResponse<T>>(routes.scroll(dataEntity), {
        metric,
        params: {
          _fields: generateFieldsArg(fields),
          _schema: schema,
          _size: size,
          _sort: sort,
          _token: mdToken,
        },
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      })
      .then(({ headers: { 'x-vtex-md-token': resToken }, data }) => ({ mdToken: resToken, data }))
  }

  public deleteDocument({ dataEntity, id }: DeleteInput, tracingConfig?: RequestTracingConfig) {
    const metric = 'masterdata-deleteDocument'
    return this.http.delete(routes.document(dataEntity, id), {
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

interface GetSchemaInput {
  dataEntity: string
  schema: string
}

interface AggregationInput {
  schema?: string
  dataEntity: string
  field: string
  type: 'count' | 'sum' | 'max' | 'min' | 'avg' | 'date-time-interval' | 'stats'
  where?: string
  cumulative?: string
  derivative?: string
  interval?: string | 'day' | 'year' | 'month'
}

interface BaseAggregationResult {
  all_docs: number
  all_docs_aggregated: number
}

interface NumberAggregationResult extends BaseAggregationResult {
  result: number
}

interface StatsAggregationResult extends BaseAggregationResult {
  result: {
    min: number
    max: number
    avg: number
    sum: number
  }
}

interface CountAggregationResult extends BaseAggregationResult {
  result: Array<{
    key: string
    value: number
  }>
}

interface CumulativeAggregationResult extends BaseAggregationResult {
  result: Array<{
    key: string
    doc_count: number
    cumulative_sum: number
    sum: number
  }>
}

interface DerivativeAggregationResult extends BaseAggregationResult {
  result: Array<{
    key: string
    doc_count: number
    derivative_sum: number
    sum: number
  }>
}

interface CumulativeDerivativeAggregationResult extends BaseAggregationResult {
  result: Array<{
    key: string
    doc_count: number
    cumulative_sum: number
    derivative_sum: number
    sum: number
  }>
}
type AggregationResult =
  | CumulativeDerivativeAggregationResult
  | DerivativeAggregationResult
  | CumulativeAggregationResult
  | CountAggregationResult
  | StatsAggregationResult
  | NumberAggregationResult

interface CreateSchemaInput {
  dataEntity: string
  schemaName: string
  schemaBody: object
}

interface GetDocumentInput {
  dataEntity: string
  id: string
  fields: string[]
}

interface CreateDocumentInput {
  dataEntity: string
  fields: object
  schema?: string
}

interface CreateOrUpdateInput {
  dataEntity: string
  fields: object
  id?: string
  schema?: string
}

interface UpdateInput {
  dataEntity: string
  id: string
  fields: object
  schema?: string
}

interface SearchInput {
  dataEntity: string
  fields: string[]
  where?: string
  pagination: PaginationArgs
  schema?: string
  sort?: string
}

interface ScrollInput {
  dataEntity: string
  fields: string[]
  schema?: string
  sort?: string
  size?: number
  mdToken?: string
}

interface DeleteInput {
  dataEntity: string
  id: string
}

interface ScrollResponse<T> {
  data: T[]
  mdToken: string
}
