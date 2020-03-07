import { Span } from 'opentracing'
import { ErrorReport } from '../../tracing/errorReporting/ErrorReport'
import { Tags } from '../../tracing/Tags'

export const injectErrorOnSpan = (span: Span, err: Error | ErrorReport) => {
  span.setTag(Tags.ERROR, 'true')

  let errorReport: ErrorReport
  if (!(err instanceof ErrorReport)) {
    const kind = ErrorReport.createGenericErrorKind(err)
    errorReport = new ErrorReport({
      kind,
      message: err.message,
      originalError: err,
      tryToParseError: true,
    })
  } else {
    errorReport = err
  }

  span.setTag(Tags.ERROR_KIND, errorReport.kind)
  span.log({ event: 'error', ...(errorReport as ErrorReport).toObject() })
}
