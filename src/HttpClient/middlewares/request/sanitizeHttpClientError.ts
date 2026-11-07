import { isSensitiveHeaderName, redactCredentialFields, redactRequestData, redactUrlQuery } from '../../../utils/sensitiveHeaders'
import { REDACTED } from '../../../utils/stringRedactor'

const isObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object'

/**
 * A copy of the headers with the value of every credential header replaced. Keys are kept.
 * Returns the same object when there is nothing to replace. Works on plain objects (axios 0.x)
 * and on `AxiosHeaders` (axios 1.x), whose type is kept so code that calls `headers.get()` still
 * works.
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

const assign = (target: Record<string, any>, key: string, value: unknown) => {
  try {
    target[key] = value
  } catch {
    // A frozen or non-writable property cannot be cleared.
  }
}

const isStream = (value: unknown) => isObject(value) && typeof value.pipe === 'function'

// Last resort when masking throws partway. The fields that carry credentials are replaced, rather
// than returned as they were. `response.status` and `response.data` stay; a streamed `data` keeps
// its originating request, so it stays readable but is left out of serialization.
const withholdCredentials = (error: Record<string, any>) => {
  assign(error, 'config', {})
  assign(error, 'request', undefined)
  const { response } = error
  if (!isObject(response)) {
    return
  }
  assign(response, 'config', {})
  assign(response, 'headers', {})
  assign(response, 'request', undefined)
  if (isStream(response.data)) {
    hide(response, 'data')
  }
}

type Redactor = [string, (value: unknown) => unknown]

/**
 * A copy of an axios request config without credentials. The received config is not changed:
 * nothing else that holds it (an interceptor, a retry, the caller) sees a difference.
 */
const redactConfig = (config: Record<string, any>) => {
  const copy: Record<string, any> = { ...config }
  const redactors: Redactor[] = [
    ['auth', redactAuth],
    ['proxy', proxy => isObject(proxy) && proxy.auth != null ? { ...proxy, auth: isObject(proxy.auth) ? redactAuth(proxy.auth) : REDACTED } : proxy],
    ['headers', redactHeaders],
    ['params', redactCredentialFields],
    ['data', redactRequestData],
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
 * - `config` (and `response.config`) becomes a copy with credential headers, `auth`,
 *   credential-named `params` and URL query values, and credential-named keys in the request body
 *   (`data`) replaced by `[Redacted]`.
 * - The headers of the upstream response are kept, `set-cookie` included: with `maxRedirects: 0`
 *   a redirect rejects, and apps forward its cookie. `cleanError` leaves it out of logs and error
 *   bodies, and `toJSON()` does not serialize the response.
 * - `request` and `response.request` stay readable but are no longer enumerable: they hold the
 *   serialized header block (`_header`), which cannot be rewritten after the request was sent.
 *
 * It runs on the final rejection only, after the retries, which reuse the original config.
 * It never throws. If masking fails, the fields that carry credentials are cleared where the error
 * allows it, and the error is still returned. A frozen error cannot be changed, so it is returned
 * as it is: the client always creates its errors mutable, and replacing the instance would break
 * `instanceof` and identity checks.
 */
export const sanitizeHttpClientError = <T>(err: T): T => {
  if (!isObject(err)) {
    return err
  }
  const error = err as Record<string, any>
  try {
    if (isObject(error.config)) {
      error.config = redactConfig(error.config)
    }
    hide(error, 'request')

    const { response } = error
    if (isObject(response)) {
      if (isObject(response.config)) {
        response.config = isObject(error.config) ? error.config : redactConfig(response.config)
      }
      hide(response, 'request')
      if (error.config?.responseType === 'stream') {
        hide(response, 'data')
      }
    }
  } catch (sanitizeError) {
    console.error('[node-vtex-api error] an HTTP client error could not be sanitized', (sanitizeError as Error)?.name)
    try {
      withholdCredentials(error)
    } catch (withholdError) {
      // Clearing a hostile error must not surface the failure, but it has to be visible: the error
      // may still carry its credentials. Only the class of the error is logged.
      console.error('[node-vtex-api error] the credentials of an HTTP client error could not be cleared', (withholdError as Error)?.name)
    }
  }
  return err
}
