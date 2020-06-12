import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import buildFullPath from 'axios/lib/core/buildFullPath'
import { Span } from 'opentracing'
import { ROUTER_CACHE_HEADER } from '../../constants'
import { Tags } from '../Tags'
import { ServerResponse, IncomingMessage } from 'http'

/**
 * Inject request info on Span when request is made with a axios client
 */
export const injectAxiosRequestInfoOnSpan = (span: Span, axiosInstance: AxiosInstance, config: AxiosRequestConfig) => {
  let fullUrl = null

  const spanContext: any = span.context()
  if (spanContext.isSampled == null || spanContext.isSampled()) {
    fullUrl = buildFullPath(config.baseURL, axiosInstance.getUri(config))
  }

  span.addTags({
    [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_CLIENT,
    [Tags.HTTP_METHOD]: config.method,
    [Tags.HTTP_URL]: fullUrl,
  })

  if ((config as any).retryCount) {
    span.setTag(Tags.HTTP_RETRY_COUNT, (config as any).retryCount)
  }

  span.log({ event: 'request-headers', headers: config.headers })
}

// Response may be undefined in case of client timeout, invalid URL, ...
/**
 * Inject request info on Span when request is made with a axios client
 */
export const injectResponseInfoOnSpan = (span: Span, response: AxiosResponse | IncomingMessage | null) => {
  if (!response) {
    span.setTag(Tags.HTTP_NO_RESPONSE, 'true')
    return
  }

  span.log({ event: 'response-headers', headers: response.headers })

  const status = (response as AxiosResponse).status ?? (response as IncomingMessage).statusCode
  span.setTag(Tags.HTTP_STATUS_CODE, status)
  if (response.headers[ROUTER_CACHE_HEADER]) {
    span.setTag(Tags.HTTP_ROUTER_CACHE, response.headers[ROUTER_CACHE_HEADER])
  }
}
