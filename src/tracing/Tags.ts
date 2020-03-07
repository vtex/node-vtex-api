import { Tags as opentracingTags } from 'opentracing'

export const Tags  = {
    ERROR_KIND: 'error.kind',
    HTTP_NO_RESPONSE: 'http.no-response',
    HTTP_ROUTER_CACHE: 'http.router-cache',
    ...opentracingTags,
}