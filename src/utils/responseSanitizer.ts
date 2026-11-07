import { cleanError } from './error'

/**
 * Properties of an error that hold HTTP-client internals: the request config (headers carry
 * credentials), the Node request object, and the connection agents. They are never serialized.
 * `response` is rebuilt separately, so that its headers and request are left out too.
 */
const INTERNAL_ERROR_KEYS = new Set(['config', 'request', 'httpAgent', 'httpsAgent', 'response'])

const DEFAULT_MAX_DEPTH = 32
const DEFAULT_MAX_NODES = 200000

const TRUNCATED = '[Truncated]'
const CIRCULAR = '[Circular]'

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
   * True when a depth or node limit stopped the walk early. The part that was not visited is
   * replaced by a marker, so the original subtree is not returned.
   */
  truncated: boolean
}

// `instanceof` is not enough for errors that come from another realm (a `vm` context), which
// `Object.prototype.toString` still identifies.
const isError = (node: object): node is Error =>
  node instanceof Error || Object.prototype.toString.call(node) === '[object Error]'

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
  private readonly ancestors: object[] = []
  private readonly maxDepth: number
  private readonly maxNodes: number
  private readonly linked: boolean

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
      return this.insideError > 0 ? CIRCULAR : node
    }
    if (depth > this.maxDepth || this.nodes >= this.maxNodes) {
      // Not inspected. The node itself may be an error, or may hold one, so it is not returned.
      this.truncated = true
      return TRUNCATED
    }
    this.nodes++

    // Arrays and plain objects are by far the most common, and cannot be errors, binary data or
    // streams: they are checked first.
    if (Array.isArray(node)) {
      return this.walkArray(node, depth)
    }
    if (isPlainObject(node)) {
      return this.walkObject(node, depth)
    }
    return this.walkOther(node, depth)
  }

  private walkArray(node: any[], depth: number) {
    this.ancestors.push(node)
    let result = node
    for (let i = 0; i < node.length; i++) {
      const value = node[i]
      const safe = this.walkValue(value, depth)
      if (safe !== value) {
        result = result === node ? node.slice() : result
        result[i] = safe
      }
    }
    this.ancestors.pop()

    return result
  }

  private walkObject(node: Record<string, any>, depth: number) {
    this.ancestors.push(node)
    let result = node
    for (const key of Object.keys(node)) {
      const value = node[key]
      const safe = this.walkValue(value, depth)
      if (safe !== value) {
        result = result === node ? { ...node } : result
        result[key] = safe
      }
    }
    this.ancestors.pop()

    return result
  }

  // Most values are primitives: skipping them here avoids a call per value.
  private walkValue(value: any, depth: number) {
    return value === null || typeof value !== 'object' ? value : this.walk(value, depth + 1)
  }

  // Errors, and what is neither a plain object nor an array: buffers, streams, class instances.
  private walkOther(node: object, depth: number) {
    if (isError(node)) {
      this.replaced++
      return this.toSafeError(node, depth)
    }
    return this.insideError > 0 ? describeOpaque(node) : node
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
    const copy = this.copyErrorProperties(source, depth)
    const { response } = source
    if (response !== null && typeof response === 'object') {
      copy.response = this.copyResponse(response, depth)
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

  private copyErrorProperties(source: any, depth: number) {
    const copy: Record<string, any> = {}

    for (const key of Object.keys(source)) {
      if (!INTERNAL_ERROR_KEYS.has(key)) {
        copy[key] = this.walk(source[key], depth + 1)
      }
    }

    for (const property of ['name', 'message', 'code']) {
      if (typeof source[property] === 'string') {
        copy[property] = source[property]
      }
    }

    if (this.linked && typeof source.stack === 'string') {
      copy.stack = source.stack
    }

    return copy
  }

  // Only what the upstream answered. Its headers (cookies, tokens) and the request that originated
  // it are not exposed.
  private copyResponse(response: any, depth: number) {
    return {
      data: this.walk(response.data, depth + 1),
      status: response.status,
    }
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
export type ErrorScan = 'clean' | 'has-error' | 'truncated'

interface NodeBudget {
  n: number
  max: number
}

interface ScanState {
  found: boolean
  nodes: number
  truncated: boolean
}

const isPrimitiveValue = (value: unknown) => value === null || typeof value !== 'object'

// A container whose own values cannot be an Error. Nested containers are not flat.
const isFlatData = (node: object): boolean => {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (!isPrimitiveValue(item)) {
        return false
      }
    }
    return true
  }
  if (!isPlainObject(node)) {
    return false
  }
  const record = node as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!isPrimitiveValue(record[key])) {
      return false
    }
  }
  return true
}

const enter = (budget: NodeBudget): boolean => {
  if (budget.n >= budget.max) {
    return false
  }
  budget.n++
  return true
}

// How far a plain object may nest and still be decided by the linear pass. Deeper bodies fall
// through to the budgeted scan, which also enforces the depth limit.
const SHALLOW_DEPTH = 4

// Lists of plain records, and an object wrapping them, are the common large payload. One pass
// proves they hold no Error, which is cheaper than the copying walk and stops at the same budget.
const shallowValue = (value: object, budget: NodeBudget, depth: number): ErrorScan | undefined => {
  if (isError(value)) {
    return 'has-error'
  }
  if (Array.isArray(value)) {
    return shallowList(value, budget, depth)
  }
  if (!isPlainObject(value)) {
    return enter(budget) ? 'clean' : 'truncated'
  }
  if (isFlatData(value)) {
    return enter(budget) ? 'clean' : 'truncated'
  }
  if (depth >= SHALLOW_DEPTH) {
    return undefined
  }
  return shallowRecord(value as Record<string, unknown>, budget, depth)
}

const shallowList = (rows: unknown[], budget: NodeBudget, depth: number): ErrorScan | undefined => {
  if (!enter(budget)) {
    return 'truncated'
  }
  for (const row of rows) {
    if (isPrimitiveValue(row)) {
      continue
    }
    const found = shallowValue(row as object, budget, depth + 1)
    if (found !== 'clean') {
      return found
    }
  }
  return 'clean'
}

const shallowRecord = (record: Record<string, unknown>, budget: NodeBudget, depth: number): ErrorScan | undefined => {
  if (!enter(budget)) {
    return 'truncated'
  }
  for (const key of Object.keys(record)) {
    const value = record[key]
    if (isPrimitiveValue(value)) {
      continue
    }
    const found = shallowValue(value as object, budget, depth + 1)
    if (found !== 'clean') {
      return found
    }
  }
  return 'clean'
}

const shallowScan = (value: object, maxNodes: number): ErrorScan | undefined => {
  if (isError(value)) {
    return 'has-error'
  }
  if (isFlatData(value)) {
    return maxNodes < 1 ? 'truncated' : 'clean'
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return 'clean'
  }
  return shallowValue(value, { max: maxNodes, n: 0 }, 0)
}

const scanChildren = (
  node: object,
  depth: number,
  maxDepth: number,
  maxNodes: number,
  ancestors: object[],
  state: ScanState
) => {
  if (!Array.isArray(node) && !isPlainObject(node)) {
    return
  }
  ancestors.push(node)
  const values = Array.isArray(node) ? node : Object.keys(node).map(key => (node as Record<string, unknown>)[key])
  for (const child of values) {
    if (child !== null && typeof child === 'object') {
      scanNode(child as object, depth + 1, maxDepth, maxNodes, ancestors, state)
    }
    if (state.found || state.truncated) {
      break
    }
  }
  ancestors.pop()
}

const scanNode = (
  node: object,
  depth: number,
  maxDepth: number,
  maxNodes: number,
  ancestors: object[],
  state: ScanState
) => {
  if (state.found || state.truncated || ancestors.includes(node)) {
    return
  }
  if (depth > maxDepth || state.nodes >= maxNodes) {
    state.truncated = true
    return
  }
  state.nodes++
  if (isError(node)) {
    state.found = true
    return
  }
  scanChildren(node, depth, maxDepth, maxNodes, ancestors, state)
}

const deepScan = (value: object, maxDepth: number, maxNodes: number): ErrorScan => {
  const state: ScanState = { found: false, nodes: 0, truncated: false }
  scanNode(value, 0, maxDepth, maxNodes, [], state)
  if (state.truncated) {
    return 'truncated'
  }
  return state.found ? 'has-error' : 'clean'
}

/**
 * Says whether `value` contains an `Error`, without copying it. The copying walk is only needed
 * when this returns `has-error`. `truncated` means the budget was spent before the value was fully
 * inspected, so whatever was not visited must not be sent.
 */
export const scanForErrors = (value: object, options: Pick<SanitizeErrorsOptions, 'maxDepth' | 'maxNodes'> = {}): ErrorScan => {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES
  const shallow = shallowScan(value, maxNodes)
  if (shallow !== undefined) {
    return shallow
  }
  return deepScan(value, options.maxDepth ?? DEFAULT_MAX_DEPTH, maxNodes)
}

export const toLoggableError = (value: unknown): unknown => {
  try {
    const { value: safe } = sanitizeErrors(value, { linked: true })
    if (safe !== value && value !== null && typeof value === 'object' && isError(value)) {
      return Object.assign(Object.create(Object.getPrototypeOf(value)), safe)
    }
    return safe
  } catch (err) {
    return `[error omitted: it could not be sanitized (${(err as Error)?.name})]`
  }
}
