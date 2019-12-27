import cluster, { Worker } from 'cluster'
import { constants } from 'os'

import {
  INSPECT_DEBUGGER_PORT,
  LINKED,
  UNCAUGHT_EXCEPTION,
  UP_SIGNAL,
} from '../../constants'
import { isLog, logOnceToDevConsole } from '../logger'
import { logger } from '../worker/listeners'
import {
  broadcastStatusTrack,
  isStatusTrackBroadcast,
  trackStatus,
} from '../worker/runtime/statusTrack'
import { ServiceJSON } from '../worker/runtime/typings'

let handledSignal: NodeJS.Signals | null = null

export const setHandledSignal = (signal: NodeJS.Signals) => {
  handledSignal = signal
}

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
  if (!LINKED && worker.exitedAfterDisconnect === false && code !== UNCAUGHT_EXCEPTION) {
    logger.error({
      code,
      message: 'Worker Died',
      pid: worker.process.pid,
      signal,
    })
    cluster.fork()
  }

  const exitOn = ['SIGTERM', 'SIGINT']
  if (handledSignal && exitOn.includes(handledSignal) && Object.keys(cluster.workers).length === 0) {
    process.exit(constants.signals[handledSignal])
  }
}

let workersOnline = 0
const onOnline = (worker: Worker) => {
  console.log('Worker ' + worker.process.pid + ' is listening')
  workersOnline += 1
  if (workersOnline === 1) {
    worker.send(UP_SIGNAL)
  }
}

export const startWorkers = (service: ServiceJSON) => {
  const { workers: numWorkers } = service

  // Setup dubugger
  if (LINKED) {
    cluster.setupMaster({inspectPort: INSPECT_DEBUGGER_PORT})
  }

  // Setup cluster
  console.log(`Spawning ${numWorkers} workers`)
  for(let i=0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('online', onOnline)
  cluster.on('exit', onExit)
  cluster.on('message', onMessage)
}
