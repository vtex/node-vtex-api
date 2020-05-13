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
import { getTraceInfo } from '../utils'

export class ErrorReport extends ErrorReportBase {
  public static create(args: ErrorReportCreateArgs) {
    return new ErrorReport(createErrorReportBaseArgs(args))
  }

  public injectOnSpan(span: Span, logger?: IOContext['logger']) {
    span.setTag(TracingTags.ERROR, 'true')
    span.setTag(TracingTags.ERROR_KIND, this.kind)

    if (
      isRequestInfo(this.parsedInfo) &&
      this.parsedInfo.response &&
      isInfraErrorData(this.parsedInfo.response?.data)
    ) {
      span.setTag(TracingTags.ERROR_SERVER_CODE, this.parsedInfo.response.data.code)
      span.setTag(TracingTags.ERROR_SERVER_SOURCE, this.parsedInfo.response.data.source)
      span.setTag(TracingTags.ERROR_SERVER_REQUEST_ID, this.parsedInfo.response.data.requestId)
    }

    span.log({ event: 'error', ...this.toObject() })

    if (logger && this.shouldLogToSplunk(span)) {
      logger.error(this.toObject())
      this.markErrorAsReported()
    }

    return this
  }

  private shouldLogToSplunk(span: Span) {
    return this.isErrorReported() && getTraceInfo(span).isSampled
  }
}
