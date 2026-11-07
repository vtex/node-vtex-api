// Inspired by https://github.com/sindresorhus/serialize-error
import { keys, pick } from 'ramda'

import { isSensitiveHeaderName } from './sensitiveHeaders'

export const PICKED_AXIOS_PROPS = ['baseURL', 'cacheable', 'data', 'finished', 'headers', 'method', 'timeout', 'status', 'path', 'url', 'metric', 'inflightKey', 'forceMaxAge', 'params', 'responseType']
export const SENSITIVE_EXCEPTION_FIELDS = ['config', 'request', 'stack']

const MAX_ERROR_STRING_LENGTH = process.env.MAX_ERROR_STRING_LENGTH ? parseInt(process.env.MAX_ERROR_STRING_LENGTH, 10) : 8 * 1024

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
      if (headers && typeof headers === 'object') {
        // Same list as the HttpClient error sanitizer: the account-suffixed store cookie, `cookie`,
        // `x-vtex-api-*`, `x-vtex-credential` and credential-looking names, not only three names.
        for (const headerName of keys(headers) as string[]) {
          if (isSensitiveHeaderName(headerName)) {
            delete headers[headerName]
          }
        }
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
