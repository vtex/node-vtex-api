import { AxiosError } from 'axios'
import { IncomingMessage } from 'http'

interface RequestErrorDetails {
  requestConfig: {
    url?: string
    method?: string
    params?: any
    headers?: Record<string, any>
    data?: any
    timeout?: string | number
  }
  response:
    | {
        status?: number
        statusText?: string
        headers?: Record<string, any>
        data?: any
      }
    | undefined
}

function parseAxiosError(err: AxiosError): RequestErrorDetails {
  const { url, method, headers: requestHeaders, params, data: requestData, timeout: requestTimeout } = err.config
  const { status, statusText, headers: responseHeaders, data: responseData } = err.response || {}

  return {
    requestConfig: {
      data: requestData,
      headers: requestHeaders,
      method,
      params,
      timeout: requestTimeout,
      url,
    },
    response: err.response
      ? {
          ...(responseData instanceof IncomingMessage ? { data: '[IncomingMessage]' } : { data: responseData }),
          headers: responseHeaders,
          status,
          statusText,
        }
      : undefined,
  }
}

export function parseError(err: any): Record<string, any> | null {
  if (err.isAxiosError || err.config) {
    return parseAxiosError(err)
  }

  return null
}
