// Inspired by https://github.com/sindresorhus/serialize-error
import { keys, pick } from 'ramda'

import { isKnownCredentialHeaderName, isSensitiveHeaderName, redactUrlQuery } from './sensitiveHeaders'

export const PICKED_AXIOS_PROPS = ['baseURL', 'cacheable', 'data', 'finished', 'headers', 'method', 'timeout', 'status', 'path', 'url', 'metric', 'inflightKey', 'forceMaxAge', 'params', 'responseType']
export const SENSITIVE_EXCEPTION_FIELDS = ['config', 'request', 'stack']

const MAX_ERROR_STRING_LENGTH = process.env.MAX_ERROR_STRING_LENGTH ? parseInt(process.env.MAX_ERROR_STRING_LENGTH, 10) : 8 * 1024

// Whether `target[key]` is an object kept out of `Object.entries` (not enumerable).
const isHiddenObject = (target: any, key: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  return !!descriptor && !descriptor.enumerable && 'value' in descriptor
    && descriptor.value !== null && typeof descriptor.value === 'object'
}

const pickPrimitives = (names: string[], source: any) => {
  const picked: Record<string, string | number | boolean> = {}
  for (const name of names) {
    const value = source[name]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      picked[name] = value
    }
  }
  return picked
}

const truncateString = (value: unknown) =>
  typeof value === 'string' && value.length > MAX_ERROR_STRING_LENGTH
    ? value.substring(0, MAX_ERROR_STRING_LENGTH) + '[...TRUNCATED]'
    : value

// Marks an entry `destroyCircular` leaves out.
const SKIP = Symbol('skip')

// What `destroyCircular` keeps for one own enumerable entry: functions and "private" (`_`) keys are
// left out, very large strings truncated, objects copied, and a reference back to an ancestor
// replaced by `[Circular]`.
const copyEntry = (key: string, value: unknown, seen: any[]): unknown => {
  if (typeof value === 'function' || key.startsWith('_')) {
    return SKIP
  }
  if (!value || typeof value !== 'object') {
    return truncateString(value)
  }
  return seen.includes(value) ? '[Circular]' : destroyCircular(value, seen.slice())
}

const COMMON_PROPERTIES = ['name', 'message', 'stack', 'code']

// Error properties that are usually not enumerable, so the entries above miss them.
const copyCommonProperties = (from: any, to: Record<string, any>) => {
  for (const property of COMMON_PROPERTIES) {
    if (typeof from[property] === 'string') {
      to[property] = from[property]
    }
  }
}

const AXIOS_PROPERTIES = ['config', 'request', 'response']
const URL_LOCATIONS = ['path', 'url']

const removeHeaders = (headers: Record<string, unknown>, isSensitive: (name: string) => boolean) => {
  for (const headerName of keys(headers) as string[]) {
    if (isSensitive(headerName)) {
      delete headers[headerName]
    }
  }
}

// The picked properties of an axios `config`, `request` or `response`, without credentials.
const cleanAxiosProperty = (property: string, value: object) => {
  const picked: Record<string, any> = pick(PICKED_AXIOS_PROPS, value)
  // A request path carries the serialized query, credential-named params included.
  for (const location of URL_LOCATIONS) {
    if (typeof picked[location] === 'string') {
      picked[location] = redactUrlQuery(picked[location])
    }
  }
  if (picked.headers && typeof picked.headers === 'object') {
    // Headers the app sent: the same list as the HttpClient error sanitizer, credential-looking
    // names included. Headers of the upstream response: only the known credential headers
    // (`set-cookie`), so ordinary ones such as `www-authenticate` are kept.
    removeHeaders(picked.headers, property === 'response' ? isKnownCredentialHeaderName : isSensitiveHeaderName)
  }
  return picked
}

const cleanAxiosProperties = (from: any, to: Record<string, any>) => {
  // The HttpClient hides `request` (not enumerable) because it holds the raw request with its
  // credentials. Its safe fields are still logged: only primitive values of the picked properties
  // (`method`, `path`, `finished`…), never `_header` or the socket.
  if (to.request === undefined && isHiddenObject(from, 'request')) {
    to.request = pickPrimitives(PICKED_AXIOS_PROPS, from.request)
  }
  for (const property of AXIOS_PROPERTIES) {
    if (to[property] != null && typeof to[property] === 'object') {
      to[property] = cleanAxiosProperty(property, to[property])
    }
  }
}

const httpErrorCode = (response: any) => response.status ? `E_HTTP_${response.status}` : 'E_UNKNOWN'

const destroyCircular = (from: any, seen: any[]): Record<string, any> => {
  const to: {[key: string]: any} = Array.isArray(from) ? [] : {}

  seen.push(from)

  for (const [key, value] of Object.entries(from)) {
    const copied = copyEntry(key, value, seen)
    if (copied !== SKIP) {
      to[key] = copied
    }
  }

  copyCommonProperties(from, to)
  cleanAxiosProperties(from, to)

  if (!to.code && to.response) {
    to.code = httpErrorCode(to.response)
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
