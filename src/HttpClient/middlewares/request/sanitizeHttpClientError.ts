import { isKnownCredentialHeaderName, isSensitiveHeaderName, isSensitiveParamName, redactUrlQuery } from '../../../utils/sensitiveHeaders'
import { REDACTED, TRUNCATED } from '../../../utils/stringRedactor'

const isObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object'

/**
 * A copy of the headers with the value of every header `isSensitive` selects replaced. Keys are
 * kept. Returns the same object when there is nothing to replace. Works on plain objects (axios
 * 0.x) and on `AxiosHeaders` (axios 1.x), whose type is kept so code that calls `headers.get()`
 * still works.
 */
const redactHeaders = (headers: unknown, isSensitive: (name: string) => boolean = isSensitiveHeaderName) => {
  if (!isObject(headers)) {
    return headers
  }
  const values: Record<string, unknown> = typeof headers.toJSON === 'function' ? headers.toJSON() : headers
  const sensitive = Object.keys(values).filter(name => isSensitive(name) && values[name] != null)
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
    const safe = redactParam(params, name, value, depth)
    if (safe !== value) {
      copy = copy === params ? shallowCopy(params) : copy
      copy[name] = safe
    }
  }
  return copy
}

// The value of one param: replaced when an object key names a credential, inspected otherwise.
// Array indexes are not names, so array items are always inspected.
const redactParam = (params: Record<string, any>, name: string, value: unknown, depth: number): unknown =>
  !Array.isArray(params) && isSensitiveParamName(name) && value != null
    ? REDACTED
    : redactParams(value, depth + 1)

const shallowCopy = (value: Record<string, any>) => Array.isArray(value) ? value.slice() : { ...value }

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
    ['proxy', proxy => isObject(proxy) && proxy.auth != null ? { ...proxy, auth: isObject(proxy.auth) ? redactAuth(proxy.auth) : REDACTED } : proxy],
    ['headers', redactHeaders],
    ['params', redactParams],
    ['url', redactUrlQuery],
    ['baseURL', redactUrlQuery],
  ]
  for (const [key, redact] of redactors) {
    if (key in config) {
      copy[key] = redact(config[key])
    }
  }
  // The agents hold their sockets, and a socket still connecting keeps the raw request, credential
  // headers included (`_pendingData`, `_httpMessage._header`). `toJSON()` would serialize them.
  AGENT_KEYS.forEach(key => hide(copy, key))
  hide(copy, 'tracing')
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
 * - Known credential headers of the upstream response (`set-cookie`) are replaced the same way;
 *   other response headers (`www-authenticate`…) are kept.
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
      // Only the known credential headers (`set-cookie`): the upstream answer has no credential of
      // the request under other names, and apps read headers such as `www-authenticate`.
      response.headers = redactHeaders(response.headers, isKnownCredentialHeaderName)
      hide(response, 'request')
      if (error.config?.responseType === 'stream') {
        hide(response, 'data')
      }
    }
  } catch (sanitizeError) {
    console.error('[node-vtex-api error] an HTTP client error could not be sanitized', (sanitizeError as Error)?.name)
  }
  return err
}
