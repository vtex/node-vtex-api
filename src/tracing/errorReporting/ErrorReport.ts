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
import { isReportingError, whileReportingError } from './reportingScope'

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
   * span is part of a **sampled** trace, then the error will be logged,
   * unless it is the failure of an operation that the logger started
   * while writing another error report.
   */
  public injectOnSpan(span?: Span, logger?: IOContext['logger']) {
    span?.setTag(TracingTags.ERROR, 'true')

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
    span?.log({
      event: 'error',
      ...indexedLogs,
      [ErrorReportLogFields.ERROR_MESSAGE]: serializableError.message,
      [ErrorReportLogFields.ERROR_METADATA_METRICS_INSTANTIATION_TIME]: serializableError.metadata?.reportCount,
      [ErrorReportLogFields.ERROR_METADATA_REPORT_COUNT]: serializableError.metadata?.metrics?.instantiationTime,
      [ErrorReportLogFields.ERROR_STACK]: serializableError.stack,
      [ErrorReportLogFields.ERROR_CODE]: serializableError.code,
    })

    // The logger comes from the request context, and an app may have replaced it with one that makes
    // requests of its own (to store its logs, for instance). When such a request fails on a sampled
    // trace, reporting that failure through the same logger makes another request, which fails and
    // is reported again, without end. So a failure of something the logger started is not written to
    // the logger: it stays on the span, and still rejects to whoever made the request.
    if (logger && this.shouldLogToSplunk(span) && !isReportingError()) {
      whileReportingError(() => logger.error(serializableError))
      this.markErrorAsReported()
    }

    return this
  }

  private shouldLogToSplunk(span?: Span) {
    return !this.isErrorReported() && getTraceInfo(span)?.isSampled
  }
}
