import { AxiosError } from 'axios'
import { randomBytes } from 'crypto'
import { ErrorKinds } from './ErrorKinds'

interface ErrorReportArguments {
  kind: string
  message: string
  originalError: Error
  tryToParseError?: boolean
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
  response: {
    status?: number
    statusText?: string
    headers?: Record<string, any>
    data?: any
  }
}

export class ErrorReport extends Error {
  public static createGenericErrorKind(error: AxiosError | Error | any) {
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
      response: {
        data: responseData,
        headers: responseHeaders,
        status,
        statusText,
      },
    }
  }

  public readonly kind: string
  public readonly originalError: any
  public readonly errorDetails: any
  public readonly errorId: string

  constructor({ kind, message, originalError, tryToParseError = false }: ErrorReportArguments) {
    super(message)
    this.kind = kind
    this.originalError = originalError
    this.errorId = randomBytes(16).toString('hex')
    this.stack = originalError.stack

    this.errorDetails = ErrorReport.getRequestErrorMetadata(this.originalError as AxiosError)
    if (tryToParseError) {
      if (this.errorDetails?.response.data?.message) {
        this.message = this.errorDetails.response.data.message
      } else {
        this.message = this.originalError.message
      }
    }
  }

  public toObject() {
    return {
      errorDetails: this.errorDetails,
      errorId: this.errorId,
      kind: this.kind,
      message: this.message,
      stack: this.stack,
      ... this.originalError.code ? { code: this.originalError.code } : null,
    }
  }
}
