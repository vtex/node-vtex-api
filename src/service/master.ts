import cluster, { Worker } from 'cluster'
import { constants } from 'os'

import { INSPECT_DEBUGGER_PORT, LINKED, UP_SIGNAL } from '../constants'
import { isLog, logOnceToDevConsole } from './logger'
import { logger } from './worker/listeners'
import {
  broadcastStatusTrack,
  isStatusTrackBroadcast,
  trackStatus,
} from './worker/runtime/statusTrack'
import { ServiceJSON } from './worker/runtime/typings'

let handledSignal: NodeJS.Signals | undefined

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
  if (!LINKED && worker.exitedAfterDisconnect === false) {
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
    process.exit((constants.signals as any)[handledSignal])
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

const handleSignal: NodeJS.SignalsListener = signal => {
  // Log the Master Process received a signal
  const message = `Master process ${process.pid} received signal ${signal}`
  console.warn(message)
  logger.warn({message, signal})

  // For each worker, let's try to kill it gracefully
  Object.values(cluster.workers).forEach(worker => worker?.kill(signal))

  // Let's raise the flag to kill the master process after all workers have died
  handledSignal = signal

  // If the worker refuses to die after some milliseconds, let's force it to die
  setTimeout(() => Object.values(cluster.workers).forEach(worker => worker?.process.kill('SIGKILL')), 1e3)
  // If master refuses to die after some milliseconds, let's force it to die
  setTimeout(() => process.exit((constants.signals as any)[signal]), 1.5e3)
}

export const startMaster = (service: ServiceJSON) => {
  const { workers: numWorkers } = service

  if (service.deterministicVary) {
    process.env.DETERMINISTIC_VARY = 'true'
  }

  // Setup dubugger
  if (LINKED) {
    cluster.setupMaster({inspectPort: INSPECT_DEBUGGER_PORT})
  }

  console.log(`Spawning ${numWorkers} workers`)
  for(let i=0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('online', onOnline)
  cluster.on('exit', onExit)
  cluster.on('message', onMessage)

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
}
