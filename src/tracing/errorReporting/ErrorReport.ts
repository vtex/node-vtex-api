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
import { ErrorReportLogFields } from '../LogFields'
import { getTraceInfo } from '../utils'

export class ErrorReport extends ErrorReportBase {
  /**
   * Create a new ErrorReport wrapping args.originalError
   *
   * In case the args.originalError argument is already an ErrorReport
   * instance, then ErrorReport.create just returns it. If it's not,
   * it returns a new ErrorReport wrapping the error. This way you can
   * use ErrorReport.create on a catchAll, e.g.:
   *
   * ```
   * try {
   *   await next()
   * } catch(err) {
   *   ErrorReport.create({ originalError: err }).injectOnSpan(span)
   * }
   * ```
   *
   * More docs on the ErrorReport available on: https://github.com/vtex/node-error-report
   */
  public static create(args: ErrorReportCreateArgs): ErrorReport {
    if (args.originalError instanceof ErrorReport) {
      return args.originalError
    }

    return new ErrorReport(createErrorReportBaseArgs(args))
  }

  /**
   * Inject information about the error wrapped by this ErrorReport
   * instance on the provided Span. If a logger is provided and the
   * span is part of a **sampled** trace, then the error will be logged.
   */
  public injectOnSpan(span: Span, logger?: IOContext['logger']) {
    span.setTag(TracingTags.ERROR, 'true')

    const indexedLogs: Record<string, string> = {
      [ErrorReportLogFields.ERROR_KIND]: this.kind,
      [ErrorReportLogFields.ERROR_ID]: this.metadata.errorId,
    }

    if (
      isRequestInfo(this.parsedInfo) &&
      this.parsedInfo.response &&
      isInfraErrorData(this.parsedInfo.response?.data)
    ) {
      indexedLogs[ErrorReportLogFields.ERROR_SERVER_CODE] = this.parsedInfo.response.data.code
      indexedLogs[ErrorReportLogFields.ERROR_SERVER_REQUEST_ID] = this.parsedInfo.response.data.requestId
    }

    const serializableError = this.toObject()
    span.log({
      event: 'error',
      ...indexedLogs,
      [ErrorReportLogFields.ERROR_MESSAGE]: serializableError.message,
      [ErrorReportLogFields.ERROR_METADATA_METRICS_INSTANTIATION_TIME]: serializableError.metadata.reportCount,
      [ErrorReportLogFields.ERROR_METADATA_REPORT_COUNT]: serializableError.metadata.metrics.instantiationTime,
      [ErrorReportLogFields.ERROR_STACK]: serializableError.stack,
      [ErrorReportLogFields.ERROR_CODE]: serializableError.code,
    })

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
