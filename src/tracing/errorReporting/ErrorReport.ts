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
  public static create(args: ErrorReportCreateArgs) {
    return new ErrorReport(createErrorReportBaseArgs(args))
  }

  /**
   * In case the err argument is a ErrorReport already it just return it
   * If it's not, it returns a new generic ErrorReport wrapping the error
   */
  public static maybeWrapError(err: Error | ErrorReport): ErrorReport {
    if (err instanceof ErrorReport) {
      return err
    }

    return ErrorReport.create({ originalError: err })
  }

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
