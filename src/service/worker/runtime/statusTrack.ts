import cluster from 'cluster'

import { LINKED } from '../../../constants'
import { ServiceContext } from './typings'

export type StatusTrack = () => EnvMetric[]

export interface NamedMetric {
  name: string,
  [key: string]: any
}

export interface EnvMetric extends NamedMetric {
  production: boolean,
}

const BROADCAST_STATUS_TRACK = 'broadcastStatusTrack'
const STATUS_TRACK = 'statusTrack'

export const isStatusTrack = (message: any): message is typeof STATUS_TRACK =>
  message === STATUS_TRACK

export const isStatusTrackBroadcast = (message: any): message is typeof BROADCAST_STATUS_TRACK =>
  message === BROADCAST_STATUS_TRACK

export const statusTrackHandler = async (ctx: ServiceContext) => {
  // Parity with the other builtin handlers: name the request so its samples don't
  // land in the catch-all `handler="undefined"` bucket.
  ctx.requestHandlerName = 'builtin:status-track'
  ctx.tracing?.currentSpan?.setOperationName(ctx.requestHandlerName)
  if (!LINKED) {
    process.send?.(BROADCAST_STATUS_TRACK)
  }
  ctx.body = []
  return
}

export const trackStatus = () => {
  // Flushing resets the metric accumulators, the CPU usage baseline and the
  // incoming request stats, so it must keep running even though nothing
  // consumes the returned metrics anymore.
  global.metrics.statusTrack()
}

export const broadcastStatusTrack = () => Object.values(cluster.workers).forEach(
  worker => worker?.send(STATUS_TRACK)
)
