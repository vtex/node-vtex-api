import { Worker } from 'cluster'
import { AggregatorRegistry, register } from 'prom-client'

import { logger } from '../worker/listeners'

/**
 * Cluster-wide Prometheus metrics aggregation.
 *
 * In multi-worker mode each cluster worker keeps its own prom-client default
 * registry. Serving `/metrics` from a single (round-robin selected) worker
 * therefore exposes only that worker's local counters, which makes Prometheus
 * treat the per-scrape braid of independent counters as counter resets and
 * inflates `rate()`/`increase()` by orders of magnitude.
 *
 * This module uses prom-client's `AggregatorRegistry` cluster IPC protocol so
 * that the worker answering a scrape asks the master for a merged, monotonic
 * view built from every worker's registry in one pass (no double-counting of
 * the answering worker).
 */

/** Tagged IPC message: worker -> master, "please build the cluster aggregate". */
export const AGG_METRICS_REQ = 'vtex-api:aggMetricsReq'
/** Tagged IPC message: master -> worker, carries the aggregate (or an error). */
export const AGG_METRICS_RES = 'vtex-api:aggMetricsRes'

/**
 * Upper bound for a worker waiting on the master aggregate. prom-client's own
 * `clusterMetrics()` has a 5s timeout collecting worker registries; we guard
 * slightly above that and fall back to the local registry on expiry so that
 * `/metrics` never hangs or returns empty.
 */
const AGG_METRICS_TIMEOUT_MS = 6000

export interface AggMetricsReqMessage {
  type: typeof AGG_METRICS_REQ
  id: number
}

export interface AggMetricsResMessage {
  type: typeof AGG_METRICS_RES
  id: number
  body?: string
  error?: string
}

export const isAggMetricsRequest = (message: any): message is AggMetricsReqMessage =>
  message?.type === AGG_METRICS_REQ && typeof message?.id === 'number'

export const isAggMetricsResponse = (message: any): message is AggMetricsResMessage =>
  message?.type === AGG_METRICS_RES && typeof message?.id === 'number'

/**
 * prom-client's cluster protocol emits its own tagged IPC messages
 * (`prom-client:getMetricsReq` / `prom-client:getMetricsRes`). They are handled
 * by prom-client's own cluster listeners, so our `onMessage` handlers must
 * ignore them instead of warning about "unknown" messages.
 */
export const isPromClientMessage = (message: any): boolean =>
  typeof message?.type === 'string' && message.type.startsWith('prom-client:')

// ---------------------------------------------------------------------------
// Master side
// ---------------------------------------------------------------------------

let masterAggregatorRegistry: AggregatorRegistry | undefined

/**
 * Constructs the master-side `AggregatorRegistry` (idempotent). Its constructor
 * installs prom-client's master `cluster.on('message')` collector, which is
 * what makes `clusterMetrics()` work. Must be called in the master before any
 * worker can answer a scrape.
 */
export const initMasterAggregatorRegistry = (): AggregatorRegistry => {
  if (!masterAggregatorRegistry) {
    masterAggregatorRegistry = new AggregatorRegistry()
  }
  return masterAggregatorRegistry
}

/**
 * Handles an `AGG_METRICS_REQ` from a worker: builds the cluster aggregate and
 * replies to that worker only. prom-client fans the request out to *all*
 * connected workers (including the requester), so the requester is one of the N
 * merged sources and is never double-counted.
 */
export const handleWorkerMetricsRequest = async (worker: Worker, message: AggMetricsReqMessage): Promise<void> => {
  const aggregator = initMasterAggregatorRegistry()
  try {
    const body = await aggregator.clusterMetrics()
    worker.send({ type: AGG_METRICS_RES, id: message.id, body })
  } catch (err) {
    worker.send({ type: AGG_METRICS_RES, id: message.id, error: (err as Error)?.message ?? String(err) })
  }
}

// ---------------------------------------------------------------------------
// Worker side
// ---------------------------------------------------------------------------

let workerAggregatorRegistry: AggregatorRegistry | undefined

interface PendingRequest {
  resolve: (body: string) => void
  timer: NodeJS.Timeout
}

const pendingRequests = new Map<number, PendingRequest>()
let requestCounter = 0

/**
 * Constructs the worker-side `AggregatorRegistry` (idempotent). Its constructor
 * installs prom-client's worker `process.on('message')` responder that answers
 * the master's `getMetricsReq` with this worker's registry JSON.
 */
export const ensureWorkerAggregatorRegistry = (): AggregatorRegistry => {
  if (!workerAggregatorRegistry) {
    workerAggregatorRegistry = new AggregatorRegistry()
  }
  return workerAggregatorRegistry
}

/**
 * Requests the cluster aggregate from the master over IPC and resolves with the
 * merged exposition string. On timeout or any error it falls back to this
 * worker's local `register.metrics()` so `/metrics` always answers promptly.
 */
export const requestAggregatedMetrics = async (): Promise<string> => {
  if (typeof process.send !== 'function') {
    return register.metrics()
  }

  const id = requestCounter++

  return new Promise<string>((resolve) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id)
      logger.warn({
        message: 'Timed out waiting for aggregated cluster metrics; falling back to local registry',
        pid: process.pid,
      })
      register.metrics().then(resolve).catch(() => resolve(''))
    }, AGG_METRICS_TIMEOUT_MS)

    pendingRequests.set(id, { resolve, timer })

    try {
      process.send!({ type: AGG_METRICS_REQ, id })
    } catch (err) {
      clearTimeout(timer)
      pendingRequests.delete(id)
      logger.warn({
        content: (err as Error)?.message ?? String(err),
        message: 'Failed to request aggregated cluster metrics; falling back to local registry',
        pid: process.pid,
      })
      register.metrics().then(resolve).catch(() => resolve(''))
    }
  })
}

/**
 * Resolves the pending `requestAggregatedMetrics` promise correlated by id when
 * the master replies. On error it falls back to the local registry.
 */
export const handleMasterMetricsResponse = (message: AggMetricsResMessage): void => {
  const pending = pendingRequests.get(message.id)
  if (!pending) {
    return
  }

  pendingRequests.delete(message.id)
  clearTimeout(pending.timer)

  if (message.error != null || message.body == null) {
    logger.warn({
      content: message.error,
      message: 'Master failed to aggregate cluster metrics; falling back to local registry',
      pid: process.pid,
    })
    register.metrics().then(pending.resolve).catch(() => pending.resolve(''))
    return
  }

  pending.resolve(message.body)
}

/** Test-only helper to reset module state between test cases. */
export const __resetForTests = () => {
  masterAggregatorRegistry = undefined
  workerAggregatorRegistry = undefined
  pendingRequests.forEach((p) => clearTimeout(p.timer))
  pendingRequests.clear()
  requestCounter = 0
}
