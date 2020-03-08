import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import buildFullPath from 'axios/lib/core/buildFullPath'
import { Span } from 'opentracing'
import { ROUTER_CACHE_HEADER } from '../../../../../../constants'
import { Tags } from '../../../../../../tracing/Tags'

export const injectRequestInfoOnSpan = (span: Span, http: AxiosInstance, config: AxiosRequestConfig) => {
  let fullUrl = null
  if ((span.context() as any).isSampled?.() ?? true) {
    fullUrl = buildFullPath(config.baseURL, http.getUri(config))
  }

  span.addTags({
    [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_CLIENT,
    [Tags.HTTP_METHOD]: config.method,
    [Tags.HTTP_URL]: fullUrl,
  })

  span.log({ event: 'request-headers', headers: config.headers })
}

// Response may be undefined in case of client timeout, invalid URL, ...
export const injectResponseInfoOnSpan = (span: Span, response: AxiosResponse | null) => {
  if (!response) {
    span.setTag(Tags.HTTP_NO_RESPONSE, 'true')
    return
  }

  span.log({ event: 'response-headers', headers: response.headers })
  span.setTag(Tags.HTTP_STATUS_CODE, response.status)
  if (response.headers[ROUTER_CACHE_HEADER]) {
    span.setTag(Tags.HTTP_ROUTER_CACHE, response.headers[ROUTER_CACHE_HEADER])
  }
}
