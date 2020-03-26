import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { FORMAT_HTTP_HEADERS, Span } from 'opentracing'
import { injectErrorOnSpan } from '../../../../../../service/tracing/spanSetup'
import { IUserLandTracer } from '../../../../../../tracing/UserLandTracer'
import { injectRequestInfoOnSpan, injectResponseInfoOnSpan } from './spanSetup'

interface RequestTracingContext {
  tracer: IUserLandTracer
  rootSpan?: Span
  requestSpan?: Span
}

interface TraceableAxiosRequestConfig extends AxiosRequestConfig {
  tracing?: RequestTracingContext
}

interface TraceableAxiosResponse extends AxiosResponse {
  config: TraceableAxiosRequestConfig
}

const preRequestInterceptor = (http: AxiosInstance) => (
  config: TraceableAxiosRequestConfig
): TraceableAxiosRequestConfig => {
  if (!config.tracing) {
    return config
  }

  const { rootSpan, tracer } = config.tracing
  const span = tracer.startSpan('http-request', { childOf: rootSpan })
  injectRequestInfoOnSpan(span, http, config)

  config.tracing.requestSpan = span
  tracer.inject(span, FORMAT_HTTP_HEADERS, config.headers)
  return config
}

const onResponseSuccess = (response: TraceableAxiosResponse): TraceableAxiosResponse => {
  if (!response.config.tracing) {
    return response
  }

  const requestSpan = response.config.tracing.requestSpan!
  injectResponseInfoOnSpan(requestSpan, response)
  requestSpan.finish()
  return response
}

const onResponseError = (err: any) => {
  if (!err?.config?.tracing?.requestSpan) {
    return Promise.reject(err)
  }

  const { requestSpan } = err.config.tracing
  injectResponseInfoOnSpan(requestSpan, err.response)
  injectErrorOnSpan(requestSpan, err)
  requestSpan.finish()
  return Promise.reject(err)
}

export const addTracingPreRequestInterceptor = (http: AxiosInstance) => {
  const requestTracingInterceptor = http.interceptors.request.use(preRequestInterceptor(http), undefined)

  return { requestTracingInterceptor }
}

export const addTracingResponseInterceptor = (http: AxiosInstance) => {
  const responseTracingInterceptor = http.interceptors.response.use(onResponseSuccess, onResponseError)

  return { responseTracingInterceptor }
}
