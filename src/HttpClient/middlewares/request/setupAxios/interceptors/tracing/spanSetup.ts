import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { Span } from 'opentracing'
import { HeaderKeys } from '../../../../../../constants'
import { CustomHttpTags, OpentracingTags } from '../../../../../../tracing/Tags'
import { cloneAndSanitizeHeaders } from '../../../../../../tracing/utils'
import buildFullPath from '../../../../../../utils/buildFullPath'

export const injectRequestInfoOnSpan = (span: Span | undefined, http: AxiosInstance, config: AxiosRequestConfig) => {
  span?.addTags({
    [OpentracingTags.SPAN_KIND]: OpentracingTags.SPAN_KIND_RPC_CLIENT,
    [OpentracingTags.HTTP_METHOD]: config.method,
    [OpentracingTags.HTTP_URL]: buildFullPath(config.baseURL, http.getUri(config)),
  })

  span?.log({ 'request-headers': cloneAndSanitizeHeaders(config.headers as any) })
}

// Response may be undefined in case of client timeout, invalid URL, ...
export const injectResponseInfoOnSpan = (span: Span | undefined, response: AxiosResponse<any> | undefined) => {
  if (!response) {
    span?.setTag(CustomHttpTags.HTTP_NO_RESPONSE, 'true')
    return
  }

  span?.log({ 'response-headers': cloneAndSanitizeHeaders(response.headers) })
  span?.setTag(OpentracingTags.HTTP_STATUS_CODE, response.status)

  if (response.headers[HeaderKeys.ROUTER_CACHE]) {
    span?.setTag(CustomHttpTags.HTTP_ROUTER_CACHE_RESULT, response.headers[HeaderKeys.ROUTER_CACHE])
  }
}
