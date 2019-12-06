import cluster from 'cluster'

import { ACCOUNT, APP, LINKED, PRODUCTION, WORKSPACE } from '../../../constants'
import { ServiceRuntimeContext } from './typings'

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

export const statusTrackHandler = async (ctx: ServiceRuntimeContext) => {
  if (!LINKED) {
    process.send?.(BROADCAST_STATUS_TRACK)
    ctx.body = []
  }
  return
}

export const trackStatus = () => {
  const status = global.metrics.statusTrack()
  logStatus(status)
}

export const broadcastStatusTrack = () => Object.values(cluster.workers).forEach(
  worker => worker?.send(STATUS_TRACK)
)

const logStatus = (status: EnvMetric[]) => console.log(JSON.stringify({
  __VTEX_IO_LOG: true,
  account: ACCOUNT,
  app: APP.ID,
  isLink: LINKED,
  pid: process.pid,
  production: PRODUCTION,
  status,
  type: 'metric/status',
  workspace: WORKSPACE,
}))
