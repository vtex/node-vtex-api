import { AxiosError } from 'axios'
import { randomBytes } from 'crypto'
import { Span } from 'opentracing'
import { TracingTags } from '..'
import { IOContext } from '../../service/worker/runtime/typings'
import { ErrorKinds } from './ErrorKinds'
import { parseError } from './errorParsing'
import { truncateAndSanitizeStringsFromObject } from './utils'

interface ErrorCreationArguments {
  kind?: string
  message?: string
  originalError: Error
}

interface ReportedError extends Error {
  errorReportMetadata: {
    errorId: string
  }
}

interface ErrorReportArguments {
  kind: string
  message: string
  originalError: Error | ReportedError
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

  public readonly kind: string
  public readonly originalError: Error | ReportedError | any
  public readonly errorId: string
  public readonly errorDetails?: any
  public readonly parsedInfo?: RequestErrorParsedInfo

  constructor({ kind, message, originalError }: ErrorReportArguments) {
    super(message)
    this.kind = kind
    this.originalError = originalError

    if ((originalError as ReportedError).errorReportMetadata) {
      this.errorId = (originalError as ReportedError).errorReportMetadata.errorId
    } else {
      this.errorId = randomBytes(16).toString('hex')
      ;(originalError as ReportedError).errorReportMetadata = {
        errorId: this.errorId,
      }
    }

    this.stack = originalError.stack
    this.message = originalError.message

    this.errorDetails = parseError(this.originalError as AxiosError)
    if (this.errorDetails?.response?.data?.code) {
      this.parsedInfo = {
        serverErrorCode: this.errorDetails.response.data.code,
        ...(this.errorDetails.response.data.source
          ? { serverErrorSource: this.errorDetails.response.data.source }
          : null),
        ...(this.errorDetails.response.data.requestId
          ? { serverErrorRequestId: this.errorDetails.response.data.requestId }
          : null),
      }
    }
  }

  public toObject(objectDepth = ErrorReport.DEFAULT_MAX_OBJECT_DEPTH) {
    return truncateAndSanitizeStringsFromObject(
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

      if (this.parsedInfo.serverErrorSource) {
        span.setTag(TracingTags.ERROR_SERVER_SOURCE, this.parsedInfo.serverErrorSource)
      }

      if (this.parsedInfo.serverErrorRequestId) {
        span.setTag(TracingTags.ERROR_SERVER_REQUEST_ID, this.parsedInfo.serverErrorRequestId)
      }
    }

    span.log({ event: 'error', ...this.toObject() })
    logger?.error(this.toObject())
    return this
  }
}
