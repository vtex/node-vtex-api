import {
  createErrorReportBaseArgs,
  ErrorReportBase,
  ErrorReportCreateArgs,
  isInfraErrorData,
  isRequestInfo,
} from '@vtex/node-error-report'
import { Span } from 'opentracing'
import { TracingTags } from '..'
import { IOContext } from '../../service/worker/runtime/typings'
import { LOG_FIELDS } from '../LogFields'
import { getTraceInfo } from '../utils'

export class ErrorReport extends ErrorReportBase {
  /**
   * In case the args.originalError argument is a ErrorReport already it just return it
   * If it's not, it returns a new ErrorReport wrapping the error.
   * This way you can use this function as a catchAll, e.g.:
   *
   * ```
   * try {
   *   await next()
   * } catch(err) {
   *   ErrorReport.create({ originalError: err }).injectOnSpan(span)
   * }
   * ```
   */
  public static create(args: ErrorReportCreateArgs): ErrorReport {
    if (args.originalError instanceof ErrorReport) {
      return args.originalError
    }

    return new ErrorReport(createErrorReportBaseArgs(args))
  }

  /**
   * Inject informations about the error on the provided Span.
   * If a logger is provided and the span is part of a **sampled**
   * trace, then the error will be logged.
   */
  public injectOnSpan(span: Span, logger?: IOContext['logger']) {
    span.setTag(TracingTags.ERROR, 'true')

    const indexedLogs: Record<string, string> = {
      [LOG_FIELDS.ERROR_KIND]: this.kind,
      [LOG_FIELDS.ERROR_ID]: this.metadata.errorId,
    }

    if (
      isRequestInfo(this.parsedInfo) &&
      this.parsedInfo.response &&
      isInfraErrorData(this.parsedInfo.response?.data)
    ) {
      indexedLogs[LOG_FIELDS.ERROR_SERVER_CODE] = this.parsedInfo.response.data.code
      indexedLogs[LOG_FIELDS.ERROR_SERVER_REQUEST_ID] = this.parsedInfo.response.data.requestId
    }

    const serializableError = this.toObject()
    span.log({ [LOG_FIELDS.EVENT]: 'error', ...indexedLogs, error: serializableError })

    if (logger && this.shouldLogToSplunk(span)) {
      logger.error(serializableError)
      this.markErrorAsReported()
    }

    return this
  }

  private shouldLogToSplunk(span: Span) {
    return !this.isErrorReported() && getTraceInfo(span).isSampled
  }
}
