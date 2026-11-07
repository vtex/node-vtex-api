import { types } from 'util'
import { cleanError } from './error'

/**
 * Properties of an error that hold HTTP-client internals: the request config (headers carry
 * credentials), the Node request object, and the connection agents. They are never serialized.
 */
const INTERNAL_ERROR_KEYS = ['config', 'request', 'httpAgent', 'httpsAgent']

const DEFAULT_MAX_DEPTH = 32
const DEFAULT_MAX_NODES = 200000

const TRUNCATED = '[Truncated]'

export interface SanitizeErrorsOptions {
  /**
   * When true (linked apps in development, and logs) the stack is kept to help debugging.
   */
  linked: boolean
  maxDepth?: number
  maxNodes?: number
}

export interface SanitizeErrorsResult<T> {
  /**
   * The same reference received when nothing had to change.
   */
  value: T
  /**
   * Number of error instances replaced by their safe representation.
   */
  replaced: number
  /**
   * True when a depth or node limit stopped the walk early. Outside of errors, the remaining part
   * was left as is. Inside an error it was replaced by a marker.
   */
  truncated: boolean
}

const isError = (node: object): node is Error =>
  types.isNativeError(node) || node instanceof Error

// Buffers and typed arrays, which have one entry per byte when walked as objects.
const isBinary = (node: object) => Buffer.isBuffer(node) || ArrayBuffer.isView(node) || node instanceof ArrayBuffer

const isPlainObject = (node: object) => {
  const proto = Object.getPrototypeOf(node)
  return proto === Object.prototype || proto === null
}

/**
 * What is shown instead of a value that is kept out of an error: binary data, streams and
 * instances of classes, which can hold large or circular graphs (sockets, agents, handles).
 */
const describeOpaque = (node: any) => {
  if (node instanceof Date) {
    return Number.isNaN(node.getTime()) ? '[Invalid Date]' : node.toISOString()
  }
  const name = node?.constructor?.name || 'Object'
  if (isBinary(node)) {
    return `[${name} ${(node as any).byteLength} bytes]`
  }
  return `[${name}]`
}

class ErrorSanitizer {
  public replaced = 0
  public truncated = false

  private nodes = 0
  private insideError = 0
  // The containers being walked, from the root. At most `maxDepth` + 1 of them, so searching it is
  // cheaper than maintaining a set.
  private ancestors: object[] = []
  private maxDepth: number
  private maxNodes: number
  private linked: boolean

  constructor({ linked, maxDepth, maxNodes }: SanitizeErrorsOptions) {
    this.linked = linked
    this.maxDepth = maxDepth ?? DEFAULT_MAX_DEPTH
    this.maxNodes = maxNodes ?? DEFAULT_MAX_NODES
  }

  /**
   * Copy-on-write walk: containers are copied only when something below them changed, and the
   * received objects are never mutated (they may be frozen, cached or still in use by the app).
   */
  public walk(node: any, depth: number): any {
    if (node === null || typeof node !== 'object') {
      return node
    }
    if (this.ancestors.includes(node)) {
      // A cycle. Inside an error it must not lead back to the received error, which has the config
      // and the request. In a body, serializing it fails regardless of this walk.
      return this.insideError > 0 ? '[Circular]' : node
    }
    if (depth > this.maxDepth || this.nodes >= this.maxNodes) {
      this.truncated = true
      return this.insideError > 0 ? TRUNCATED : node
    }
    this.nodes++

    // Arrays and plain objects are by far the most common, and cannot be errors, binary data or
    // streams: they are checked first.
    const isArray = Array.isArray(node)
    if (!isArray && !isPlainObject(node)) {
      if (isError(node)) {
        this.replaced++
        return this.toSafeError(node, depth)
      }
      return this.insideError > 0 ? describeOpaque(node) : node
    }

    this.ancestors.push(node)
    let result = node
    const keys = isArray ? undefined : Object.keys(node)
    const length = isArray ? node.length : keys!.length
    for (let i = 0; i < length; i++) {
      const key = isArray ? i : keys![i]
      const value = node[key]
      // Most values are primitives: skipping them here avoids a call per value.
      if (value === null || typeof value !== 'object') {
        continue
      }
      const safe = this.walk(value, depth + 1)
      if (safe !== value) {
        if (result === node) {
          result = isArray ? node.slice() : { ...node }
        }
        result[key] = safe
      }
    }
    this.ancestors.pop()

    return result
  }

  /**
   * Builds the object that is exposed instead of the error. It is made from a shallow copy that
   * leaves out the HTTP-client internals, so those are never traversed nor serialized, and goes
   * through `cleanError` to keep the output consistent with the one of the global error handler
   * (circular references, private and function properties, long strings).
   *
   * What reaches `cleanError` is bounded: values beyond the limits, binary data and class
   * instances were replaced by markers while walking, because `cleanError` has no limits of its own.
   */
  private toSafeError(error: Error, depth: number) {
    this.ancestors.push(error)
    this.insideError++

    const source = error as any
    const copy: Record<string, any> = {}

    for (const key of Object.keys(source)) {
      if (INTERNAL_ERROR_KEYS.includes(key) || key === 'response') {
        continue
      }
      copy[key] = this.walk(source[key], depth + 1)
    }

    for (const property of ['name', 'message', 'code']) {
      if (typeof source[property] === 'string') {
        copy[property] = source[property]
      }
    }

    if (this.linked && typeof source.stack === 'string') {
      copy.stack = source.stack
    }

    // Only what the upstream answered. Its headers (cookies, tokens) and the request that originated
    // it are not exposed.
    const { response } = source
    if (response !== null && typeof response === 'object') {
      copy.response = {
        data: this.walk(response.data, depth + 1),
        status: response.status,
      }
    }

    const safe = cleanError(copy)

    // `cleanError` picks a fixed set of response properties, which leaves `statusText` out.
    if (safe.response && typeof response?.statusText === 'string') {
      safe.response.statusText = response.statusText
    }

    this.insideError--
    this.ancestors.pop()

    return safe
  }
}

/**
 * Finds `Error` instances (including `AxiosError`) in a response body, at any depth of plain
 * objects and arrays, and replaces each one by a safe representation: the message, name, code and
 * status are kept, while the request config, the Node request, the agents, the upstream headers
 * and, unless linked, the stack are removed.
 *
 * Strings, buffers, streams and class instances other than errors are returned untouched.
 */
export const sanitizeErrors = <T>(value: T, options: SanitizeErrorsOptions): SanitizeErrorsResult<T> => {
  const sanitizer = new ErrorSanitizer(options)
  const sanitized = sanitizer.walk(value, 0)

  return {
    replaced: sanitizer.replaced,
    truncated: sanitizer.truncated,
    value: sanitized,
  }
}

/**
 * The same as `sanitizeErrors` for what is written to the process output, where the stack is
 * useful and kept. A thrown `Error` stays an error, so it is printed as one (stack, then its
 * properties), without the request config, the request and the agents.
 *
 * It never throws.
 */
export const toLoggableError = (value: unknown): unknown => {
  try {
    const { value: safe } = sanitizeErrors(value, { linked: true })
    if (safe !== value && value !== null && typeof value === 'object' && isError(value)) {
      return Object.assign(Object.create(Object.getPrototypeOf(value)), safe)
    }
    return safe
  } catch (_) {
    return '[error omitted: it could not be sanitized]'
  }
}
