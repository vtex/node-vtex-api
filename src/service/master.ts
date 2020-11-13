import cluster, { ClusterSettings, Worker } from 'cluster'
import { constants } from 'os'

import { INSPECT_DEBUGGER_PORT, LINKED, UP_SIGNAL } from '../constants'
import { isLog, logOnceToDevConsole } from './logger'
import { logger } from './worker/listeners'
import { broadcastStatusTrack, isStatusTrackBroadcast, trackStatus } from './worker/runtime/statusTrack'
import { ServiceJSON } from './worker/runtime/typings'

let handledSignal: NodeJS.Signals | undefined

const onMessage = (worker: Worker, message: any) => {
  if (isLog(message)) {
    logOnceToDevConsole(message.message, message.level)
  } else if (isStatusTrackBroadcast(message)) {
    trackStatus()
    broadcastStatusTrack()
  } else {
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

const GRACEFULLY_SHUTDOWN_TIMEOUT_S = 30
const SIGINT_TIMEOUT_S = 1

const handleSignal = (timeout: number): NodeJS.SignalsListener => (signal) => {
  // Log the Master Process received a signal
  const message = `Master process ${process.pid} received signal ${signal}`
  console.warn(message)
  logger.warn({ message, signal })

  // For each worker, let's try to kill it gracefully
  Object.values(cluster.workers).forEach((worker) => worker?.kill(signal))

  // Let's raise the flag to kill the master process after all workers have died
  handledSignal = signal

  // Let's wait for all in-flight requests finish before send any kill signal
  const waitTimeToForceKill = timeout * 1e3

  // Force workers and master to die after a graceful timeout
  setTimeout(() => {
    Object.values(cluster.workers).forEach((worker) => worker?.process.kill('SIGKILL'))
    process.exit((constants.signals as any)[signal])
  }, waitTimeToForceKill)
}

const transformArg = (args: string[], name: string, func: (value: string) => any) => {
  const argPrefix = `--${name}=`
  return args.map(arg => {
    if (!arg.startsWith(argPrefix)) {
      return arg
    }
    const value = arg.slice(argPrefix.length)
    return `${argPrefix}${func(value)}`
  })
}

export const startMaster = (service: ServiceJSON) => {
  const { workers: numWorkers, timeout = GRACEFULLY_SHUTDOWN_TIMEOUT_S } = service

  if (service.deterministicVary) {
    process.env.DETERMINISTIC_VARY = 'true'
  }

  const settings: ClusterSettings = {
    execArgv: transformArg(process.execArgv, 'max_old_space_size', size => parseInt(size)/numWorkers)
  }
  if (LINKED) {
    // Setup debugger
    settings.inspectPort = INSPECT_DEBUGGER_PORT
  }
  cluster.setupMaster(settings)

  const shutdownTimeout = Math.max(GRACEFULLY_SHUTDOWN_TIMEOUT_S, timeout)

  console.log(`Spawning ${numWorkers} workers`)
  console.log(`Using ${shutdownTimeout} seconds as worker graceful shutdown timeout`)
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('online', onOnline)
  cluster.on('exit', onExit)
  cluster.on('message', onMessage)

  process.on('SIGINT', handleSignal(SIGINT_TIMEOUT_S))

  process.on('SIGTERM', handleSignal(shutdownTimeout))
}
