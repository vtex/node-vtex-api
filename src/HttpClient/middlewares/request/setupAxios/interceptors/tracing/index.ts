import { AxiosError, AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios'
import { FORMAT_HTTP_HEADERS, Span } from 'opentracing'
import { createSpanReference, ErrorReport } from '../../../../../../tracing'
import { SpanReferenceTypes } from '../../../../../../tracing/spanReference/SpanReferenceTypes'
import { MiddlewaresTracingContext } from '../../../../../typings'
import { injectRequestInfoOnSpan, injectResponseInfoOnSpan } from './spanSetup'

interface AxiosRequestTracingContext extends MiddlewaresTracingContext {
  requestSpan?: Span
}

// Modificado para usar AxiosRequestConfig em vez de InternalAxiosRequestConfig
interface TraceableAxiosRequestConfig extends AxiosRequestConfig {
  tracing?: AxiosRequestTracingContext
}

interface TraceableAxiosResponse extends AxiosResponse {
  config: TraceableAxiosRequestConfig
}

interface ExtendedAxiosError extends AxiosError {
  config: TraceableAxiosRequestConfig
}

export const requestSpanPrefix = 'http-request'

const preRequestInterceptor = (http: AxiosInstance) => (
  config: TraceableAxiosRequestConfig
): TraceableAxiosRequestConfig => {
  if (!config.tracing || !config.tracing?.isSampled) {
    return config
  }

  const { tracer, rootSpan, requestSpanNameSuffix } = config.tracing
  const spanName = requestSpanNameSuffix ? `${requestSpanPrefix}:${requestSpanNameSuffix}` : requestSpanPrefix

  const span = rootSpan
    ? tracer.startSpan(spanName, {
        references: [createSpanReference(rootSpan, SpanReferenceTypes.CHILD_OF)],
      })
    : tracer.startSpan(spanName)

  injectRequestInfoOnSpan(span, http, config)

  config.tracing.requestSpan = span
  tracer.inject(span, FORMAT_HTTP_HEADERS, config.headers)

  return config
}

const onResponseSuccess = (response: TraceableAxiosResponse): TraceableAxiosResponse => {
  if (!response.config.tracing || !response.config.tracing?.isSampled) {
    return response
  }

  const requestSpan = response.config.tracing?.requestSpan
  injectResponseInfoOnSpan(requestSpan, response)
  requestSpan?.finish()

  return response
}

const onResponseError = (err: ExtendedAxiosError) => {
  if (!err?.config?.tracing?.requestSpan || !err.config.tracing?.isSampled) {
    return Promise.reject(err)
  }

  const { requestSpan } = err.config.tracing
  injectResponseInfoOnSpan(requestSpan, err.response)
  ErrorReport.create({ originalError: err }).injectOnSpan(requestSpan, err.config.tracing.logger)
  requestSpan.finish()

  return Promise.reject(err)
}

export const addTracingPreRequestInterceptor = (http: AxiosInstance) => {
  // Usando type assertion para compatibilidade com TypeScript 3.9.7
  const requestTracingInterceptor = http.interceptors.request.use(
    preRequestInterceptor(http) as any,
    undefined
  )

  return { requestTracingInterceptor }
}

export const addTracingResponseInterceptor = (http: AxiosInstance) => {
  // Usando type assertion para compatibilidade com TypeScript 3.9.7
  const responseTracingInterceptor = http.interceptors.response.use(
    onResponseSuccess as any,
    onResponseError as any
  )

  return { responseTracingInterceptor }
}
