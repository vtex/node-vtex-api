import { AxiosError } from 'axios'
import { randomBytes } from 'crypto'
import { IncomingMessage } from 'http'
import { Span } from 'opentracing'
import { TracingTags } from '..'
import { ErrorKinds } from './ErrorKinds'
import { truncateStringsFromObject } from './utils'

interface ErrorCreationArguments {
  kind?: string
  message?: string
  originalError: Error
}

interface ErrorReportArguments {
  kind: string
  message: string
  originalError: Error
}

interface RequestErrorDetails {
  requestConfig: {
    url?: string
    method?: string
    params?: any
    headers?: Record<string, any>
    data?: any
    timeout?: string | number
  }
  response:
    | {
        status?: number
        statusText?: string
        headers?: Record<string, any>
        data?: any
      }
    | undefined
}

interface RequestErrorParsedInfo {
  serverErrorCode: string
  serverErrorSource?: string
  serverErrorRequestId?: string
}

export class ErrorReport extends Error {
  public static create(args: ErrorCreationArguments) {
    const kind = args.kind ?? this.createGenericErrorKind(args.originalError)
    const message = args.message ?? args.originalError?.message

    return new ErrorReport({
      kind,
      message,
      originalError: args.originalError,
    })
  }

  private static readonly MAX_ERROR_STRING_LENGTH = process.env.MAX_ERROR_STRING_LENGTH
    ? parseInt(process.env.MAX_ERROR_STRING_LENGTH, 10)
    : 8 * 1024

  private static readonly DEFAULT_MAX_OBJECT_DEPTH = 8

  private static createGenericErrorKind(error: AxiosError | Error | any) {
    if (error.config) {
      return ErrorKinds.REQUEST_ERROR
    }

    return ErrorKinds.GENERIC_ERROR
  }

  private static getRequestErrorMetadata(err: AxiosError): RequestErrorDetails | null {
    if (!err.config) {
      return null
    }

    const { url, method, headers: requestHeaders, params, data: requestData, timeout: requestTimeout } = err.config
    const { status, statusText, headers: responseHeaders, data: responseData } = err.response || {}

    return {
      requestConfig: {
        data: requestData,
        headers: requestHeaders,
        method,
        params,
        timeout: requestTimeout,
        url,
      },
      response: err.response
        ? {
            ...(responseData instanceof IncomingMessage ? { data: '[IncomingMessage]' } : { data: responseData }),
            headers: responseHeaders,
            status,
            statusText,
          }
        : undefined,
    }
  }

  public readonly kind: string
  public readonly originalError: any
  public readonly errorId: string
  public readonly errorDetails?: any
  public readonly parsedInfo?: RequestErrorParsedInfo

  constructor({ kind, message, originalError }: ErrorReportArguments) {
    super(message)
    this.kind = kind
    this.originalError = originalError
    this.errorId = randomBytes(16).toString('hex')
    this.stack = originalError.stack
    this.message = originalError.message

    this.errorDetails = ErrorReport.getRequestErrorMetadata(this.originalError as AxiosError)
    if (this.errorDetails?.response?.data?.code) {
      this.parsedInfo = {
        serverErrorCode: this.errorDetails.response.data.code,
        ...(this.errorDetails.response.data.source ? { serverErrorSource: this.errorDetails.response.data.source } : null),
        ...(this.errorDetails.response.data.requestId ? { serverErrorRequestId: this.errorDetails.response.data.requestId } : null),
      }
    }
  }

  public toObject(objectDepth = ErrorReport.DEFAULT_MAX_OBJECT_DEPTH) {
    return truncateStringsFromObject(
      {
        errorId: this.errorId,
        kind: this.kind,
        message: this.message,
        stack: this.stack,
        ...(this.errorDetails ? { errorDetails: this.errorDetails } : null),
        ...(this.originalError.code ? { code: this.originalError.code } : null),
      },
      ErrorReport.MAX_ERROR_STRING_LENGTH,
      objectDepth
    )
  }

  public injectOnSpan(span: Span, logger?: IOContext['logger']) {
    span.setTag(TracingTags.ERROR, 'true')
    span.setTag(TracingTags.ERROR_KIND, this.kind)

    if (this.parsedInfo) {
      span.setTag(TracingTags.ERROR_SERVER_CODE, this.parsedInfo.serverErrorCode)

      if(this.parsedInfo.serverErrorSource) {
        span.setTag(TracingTags.ERROR_SERVER_SOURCE, this.parsedInfo.serverErrorSource)
      }

      if(this.parsedInfo.serverErrorRequestId) {
        span.setTag(TracingTags.ERROR_SERVER_REQUEST_ID, this.parsedInfo.serverErrorRequestId)
      }
    }

    span.log({ event: 'error', ...this.toObject() })
    logger?.error(this.toObject())
    return this
  }
}
