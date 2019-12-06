import cluster, { Worker } from 'cluster'

import { LINKED, UP_SIGNAL } from '../constants'
import { logger } from '../utils/unhandled'
import { isLog, logOnceToDevConsole } from './logger'
import {
  broadcastStatusTrack,
  isStatusTrackBroadcast,
  trackStatus,
} from './worker/runtime/statusTrack'
import { ServiceJSON } from './worker/runtime/typings'

const onMessage = (worker: Worker, message: any) => {
  if (isLog(message)) {
    logOnceToDevConsole(message.message, message.level)
  }
  else if (isStatusTrackBroadcast(message)) {
    trackStatus()
    broadcastStatusTrack()
  }
  else {
    logger.warn({
      content: message,
      message: 'Worker sent message',
      pid: worker.process.pid,
    })
  }
}

const onExit = (worker: Worker, code: number, signal: string) => {
  if (!LINKED) {
    logger.error({
      code,
      message: 'Worker Died',
      pid: worker.process.pid,
      signal,
    })
    cluster.fork()
  }
}

let workersOnline = 0
const onOnline = (worker: Worker) => {
  if (!LINKED) {
    console.log('Worker ' + worker.process.pid + ' is listening')
  }

  workersOnline += 1
  if (workersOnline === 1) {
    worker.send(UP_SIGNAL)
  }
}

export const startMaster = (service: ServiceJSON) => {
  const { workers: numWorkers } = service

  console.log(`Spawning ${numWorkers} workers`)
  for(let i=0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('online', onOnline)
  cluster.on('exit', onExit)
  cluster.on('message', onMessage)
}
