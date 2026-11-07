import { isSensitiveHeaderName, isSensitiveParamName } from '../../../utils/sensitiveHeaders'
import { REDACTED, TRUNCATED } from '../../../utils/stringRedactor'

const isObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object'

/**
 * A copy of the headers with the value of every credential header replaced. Keys are kept. Returns
 * the same object when there is nothing to replace. Works on plain objects (axios 0.x) and on
 * `AxiosHeaders` (axios 1.x), whose type is kept so code that calls `headers.get()` still works.
 */
const redactHeaders = (headers: unknown) => {
  if (!isObject(headers)) {
    return headers
  }
  const values: Record<string, unknown> = typeof headers.toJSON === 'function' ? headers.toJSON() : headers
  const sensitive = Object.keys(values).filter(name => isSensitiveHeaderName(name) && values[name] != null)
  if (sensitive.length === 0) {
    return headers
  }

  if (typeof headers.set === 'function' && typeof headers.constructor === 'function') {
    const typedCopy = new (headers.constructor as any)(headers)
    sensitive.forEach(name => typedCopy.set(name, REDACTED))
    return typedCopy
  }

  const plainCopy: Record<string, unknown> = { ...values }
  sensitive.forEach(name => { plainCopy[name] = REDACTED })
  return plainCopy
}

const MAX_PARAMS_DEPTH = 32

/**
 * A copy of the params with the value of every credential-named key replaced, at any depth: the
 * client serializes nested params (`filter[appToken]=…`) and arrays of objects. Copy-on-write:
 * what has nothing to replace keeps its reference. Beyond the depth limit a nested container is
 * replaced by `[Truncated]` instead of being kept uninspected.
 */
const redactParams = (params: unknown, depth = 0): unknown => {
  if (!isObject(params)) {
    return params
  }
  if (depth > MAX_PARAMS_DEPTH) {
    return TRUNCATED
  }
  let copy: any = params
  for (const name of Object.keys(params)) {
    const value = params[name]
    const safe = !Array.isArray(params) && isSensitiveParamName(name) && value != null
      ? REDACTED
      : redactParams(value, depth + 1)
    if (safe !== value) {
      if (copy === params) {
        copy = Array.isArray(params) ? params.slice() : { ...params }
      }
      copy[name] = safe
    }
  }
  return copy
}

const safeDecode = (text: string) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

// Replaces the value of credential-named keys in the query of a URL, keeping the rest as written.
const redactUrl = (url: unknown) => {
  if (typeof url !== 'string') {
    return url
  }
  const queryStart = url.indexOf('?')
  if (queryStart === -1) {
    return url
  }
  const hashStart = url.indexOf('#', queryStart)
  const queryEnd = hashStart === -1 ? url.length : hashStart
  const query = url.slice(queryStart + 1, queryEnd)
  const redactedQuery = query
    .split('&')
    .map(pair => {
      const separator = pair.indexOf('=')
      const name = separator === -1 ? pair : pair.slice(0, separator)
      return separator !== -1 && isSensitiveParamName(safeDecode(name)) ? `${name}=${REDACTED}` : pair
    })
    .join('&')
  return redactedQuery === query ? url : `${url.slice(0, queryStart + 1)}${redactedQuery}${url.slice(queryEnd)}`
}

const redactAuth = (auth: unknown) => isObject(auth) ? { username: REDACTED, password: REDACTED } : auth

// Keeps the property readable by code (`if (err.request)`, `err.request.path`) while leaving it out
// of `JSON.stringify`, `util.inspect`, spread and `Object.entries`, which only see enumerable ones.
const hide = (target: Record<string, any>, key: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  if (descriptor && descriptor.enumerable && descriptor.configurable && 'value' in descriptor) {
    Object.defineProperty(target, key, { configurable: true, enumerable: false, value: descriptor.value, writable: true })
  }
}

const AGENT_KEYS = ['httpAgent', 'httpsAgent']

type Redactor = [string, (value: unknown) => unknown]

/**
 * A copy of an axios request config without credentials. The received config is not changed:
 * nothing else that holds it (an interceptor, a retry, the caller) sees a difference.
 */
const redactConfig = (config: Record<string, any>) => {
  const copy: Record<string, any> = { ...config }
  const redactors: Array<Redactor> = [
    ['auth', redactAuth],
    ['headers', redactHeaders],
    ['params', redactParams],
    ['url', redactUrl],
  ]
  for (const [key, redact] of redactors) {
    if (key in config) {
      copy[key] = redact(config[key])
    }
  }
  // The agents hold their sockets, and a socket still connecting keeps the raw request, credential
  // headers included (`_pendingData`, `_httpMessage._header`). `toJSON()` would serialize them.
  AGENT_KEYS.forEach(key => hide(copy, key))
  return copy
}

/**
 * Masks the credentials of an `HttpClient` failure before app code sees it, so serializing it
 * (`e.toJSON()`, `JSON.stringify(e)`), logging it, persisting it or embedding it in a message no
 * longer carries them.
 *
 * It masks values and keeps the error as it is: the same instance and prototype (`instanceof`,
 * `isAxiosError`), `message`, `name`, `code`, `stack`, `response.status` and `response.data`.
 * - `config` (and `response.config`) becomes a copy with credential headers, `auth`, and
 *   credential-named `params` and URL query values replaced by `[Redacted]`.
 * - Credential headers of the upstream response (`set-cookie`) are replaced the same way.
 * - `request` and `response.request` stay readable but are no longer enumerable: they hold the
 *   serialized header block (`_header`), which cannot be rewritten after the request was sent.
 *
 * It runs on the final rejection only, after the retries, which reuse the original config.
 * It never throws: on an unexpected failure the error is returned as it is.
 */
export const sanitizeHttpClientError = <T>(err: T): T => {
  if (!isObject(err)) {
    return err
  }
  try {
    const error = err as Record<string, any>
    if (isObject(error.config)) {
      error.config = redactConfig(error.config)
    }
    hide(error, 'request')

    const { response } = error
    if (isObject(response)) {
      if (isObject(response.config)) {
        response.config = isObject(error.config) ? error.config : redactConfig(response.config)
      }
      response.headers = redactHeaders(response.headers)
      hide(response, 'request')
    }
  } catch (sanitizeError) {
    console.error('[node-vtex-api error] an HTTP client error could not be sanitized', (sanitizeError as Error)?.name)
  }
  return err
}
