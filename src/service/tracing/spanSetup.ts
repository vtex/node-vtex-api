import { Span } from 'opentracing'
import { ErrorReport } from '../../tracing'
import { IOContext } from '../worker/runtime/typings'

export const injectErrorOnSpan = (span: Span, err: Error | ErrorReport, logger: IOContext['logger'] | undefined) => {
  let errorReport: ErrorReport
  if (!(err instanceof ErrorReport)) {
    errorReport = ErrorReport.create({
      message: err.message,
      originalError: err,
    })
  } else {
    errorReport = err
  }

  errorReport.injectOnSpan(span, logger)
}
