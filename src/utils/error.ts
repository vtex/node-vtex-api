// Inspired by https://github.com/sindresorhus/serialize-error
import { find, keys, pick } from 'ramda'

export const PICKED_AXIOS_PROPS = ['baseURL', 'cacheable', 'data', 'finished', 'headers', 'method', 'timeout', 'status', 'path', 'url', 'metric', 'inflightKey', 'forceMaxAge', 'params', 'responseType']

const FORBIDDEN_LOG_HEADERS = ['authorization', 'proxy-authorization', 'vtexidclientautcookie', 'x-vtex-api-appkey', 'x-vtex-api-apptoken']

const MAX_ERROR_STRING_LENGTH = process.env.MAX_ERROR_STRING_LENGTH ? parseInt(process.env.MAX_ERROR_STRING_LENGTH, 10) : 8 * 1024

const findCaseInsensitive = (target: string, set: string[]) => find(
  t => t.toLocaleLowerCase() === target,
  set
)

const destroyCircular = (from: any, seen: any[]) => {
  const to: {[key: string]: any} = Array.isArray(from) ? [] : {}

  seen.push(from)

  for (const [key, value] of Object.entries(from)) {
    // Skip functions
    if (typeof value === 'function') {
      continue
    }

    // Skip "private" properties
    if (key.startsWith('_')) {
      continue
    }

    if (!value || typeof value !== 'object') {
      // Truncate very large strings
      if (typeof value === 'string' && value.length > MAX_ERROR_STRING_LENGTH) {
        to[key] = value.substr(0, MAX_ERROR_STRING_LENGTH) + '[...TRUNCATED]'
      } else {
        to[key] = value
      }
      continue
    }

    if (!seen.includes(from[key])) {
      to[key] = destroyCircular(from[key], seen.slice())
      continue
    }

    to[key] = '[Circular]'
  }

  const commonProperties = [
    'name',
    'message',
    'stack',
    'code',
  ]

  for (const property of commonProperties) {
    if (typeof from[property] === 'string') {
      to[property] = from[property]
    }
  }

  const axiosProperties = [
    'config',
    'request',
    'response',
  ]

  for (const property of axiosProperties) {
    if (to[property] != null && typeof to[property] === 'object') {
      to[property] = pick(PICKED_AXIOS_PROPS, to[property])
      const headers = to[property] && to[property].headers
      if (headers) {
        const headerNames = keys(headers)
        FORBIDDEN_LOG_HEADERS.forEach(header => {
          const foundHeader = findCaseInsensitive(header, headerNames as string[])
          if (foundHeader) {
            delete headers[foundHeader]
          }
        })
      }
    }
  }

  if (!to.code && to.response) {
    to.code = to.response.status && `E_HTTP_${to.response.status}` || 'E_UNKNOWN'
  }

  return to
}

/**
 * Cleans errors by removing circular properties, truncating large strings and picking axios properties
 *
 * @param value an Error instance
 */
export const cleanError = (value: any) => {
  if (typeof value === 'object') {
    return destroyCircular(value, [])
  }

  // People sometimes throw things besides Error objects…
  if (typeof value === 'function') {
    // `JSON.stringify()` discards functions. We do too, unless a function is thrown directly.
    return `[Function: ${(value.name || 'anonymous')}]`
  }

  return value
}
