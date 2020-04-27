import { Span } from 'opentracing'
import { ErrorReport } from '../../tracing'

export const injectErrorOnSpan = (span: Span, err: Error | ErrorReport) => {
  let errorReport: ErrorReport
  if (!(err instanceof ErrorReport)) {
    errorReport = ErrorReport.create({
      message: err.message,
      originalError: err,
    })
  } else {
    errorReport = err
  }

  errorReport.injectOnSpan(span)
}
