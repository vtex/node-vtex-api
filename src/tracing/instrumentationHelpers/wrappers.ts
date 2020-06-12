import { Span } from 'opentracing'
import { IOContext } from '../../service/worker/runtime/typings'
import { ErrorReport } from '../errorReporting/ErrorReport'
import { createSpanReference, createSpanReferenceByContext } from '../spanReference/createSpanReference'
import { SpanReferenceTypes } from '../spanReference/SpanReferenceTypes'

type NotPromise<T> = T extends Promise<any> ? never : T

export interface CallerTracingConfig {
  currentSpan?: Span

  /**
   * The type of reference the created span will have with its parent
   * @default SpanReferenceTypes.CHILD_OF
   */
  spanReferenceType?: SpanReferenceTypes
  tracer: IOContext['tracer']
  logger: IOContext['logger']
}

export interface TracingContext {
  currentSpan: Span
  tracer: IOContext['tracer']
  logger: IOContext['logger']
}

export interface TracingInstrumentationOptions {
  /** The operationName for the span that will be created to wrap the function instrumented */
  operationName: string

  /**
   * When the function instrumented throws, the wrapper creates an ErrorReport instance
   * based on the error. This flags specifies if the wrapper should throw the ErrorReport
   * instance or the original error
   * @default true
   */
  throwErrorReport?: boolean
}

type InstrumentedSyncFn<T extends any[], U> = (tracingConfig: CallerTracingConfig, ...args: T) => U
type InstrumentedAsyncFn<T extends any[], U> = (tracingConfig: CallerTracingConfig, ...args: T) => Promise<U>

function getOptionsWithDefaults(
  options: TracingInstrumentationOptions
): TracingInstrumentationOptions & { throwErrorReport: boolean } {
  return {
    throwErrorReport: true,
    ...options,
  }
}

function startSpan(tracingConfig: CallerTracingConfig, operationName: string) {
  const spanReferenceType = tracingConfig.spanReferenceType ?? SpanReferenceTypes.CHILD_OF
  const { tracer, currentSpan } = tracingConfig
  const references = currentSpan
    ? [createSpanReference(currentSpan, spanReferenceType)]
    : [createSpanReferenceByContext(tracer.fallbackSpanContext(), spanReferenceType)]

  const span = tracer.startSpan(operationName, { references })
  return span
}

function handleError(
  err: Error | ErrorReport | any,
  span: Span,
  logger: IOContext['logger'],
  throwErrorReport: boolean
) {
  const errReport = ErrorReport.create({ originalError: err }).injectOnSpan(span, logger)
  if (throwErrorReport) {
    return errReport
  }

  return err
}

/**
 * Add tracing instrumentation to SYNC functions (functions that doesn't return promises)
 */
export function tracingInstrumentSyncFn<T extends any[], U>(
  fn: (tracingCtx: TracingContext, ...args: T) => NotPromise<U>,
  options: TracingInstrumentationOptions
): InstrumentedSyncFn<T, U> {
  const { operationName, throwErrorReport } = getOptionsWithDefaults(options)

  const syncTracingInstrument: InstrumentedSyncFn<T, U> = (callerTracingConfig, ...args: T) => {
    const span = startSpan(callerTracingConfig, operationName)
    try {
      return fn(
        {
          currentSpan: span,
          tracer: callerTracingConfig.tracer,
          logger: callerTracingConfig.logger,
        },
        ...args
      )
    } catch (err) {
      throw handleError(err, span, callerTracingConfig.logger, throwErrorReport)
    } finally {
      span.finish()
    }
  }

  return syncTracingInstrument
}

/**
 * Add tracing instrumentation to ASYNC functions or functions that return promises
 */
export function tracingInstrumentAsyncFn<T extends any[], U>(
  fn: (tracingCtx: TracingContext, ...args: T) => Promise<U>,
  options: TracingInstrumentationOptions
): (tracingConfig: CallerTracingConfig, ...args: T) => Promise<U> {
  const { operationName, throwErrorReport } = getOptionsWithDefaults(options)

  const asyncTracingInstrument: (tracingConfig: CallerTracingConfig, ...args: T) => Promise<U> = async (
    callerTracingConfig,
    ...args: T
  ) => {
    const span = startSpan(callerTracingConfig, operationName)
    try {
      return await fn(
        {
          currentSpan: span,
          tracer: callerTracingConfig.tracer,
          logger: callerTracingConfig.logger,
        },
        ...args
      )
    } catch (err) {
      throw handleError(err, span, callerTracingConfig.logger, throwErrorReport)
    } finally {
      span.finish()
    }
  }

  return asyncTracingInstrument
}
