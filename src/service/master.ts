import cluster, { Worker } from 'cluster'
import { constants } from 'os'

import { INSPECT_DEBUGGER_PORT, LINKED, UP_SIGNAL } from '../constants'
import { isLog, logOnceToDevConsole } from './logger'
import { logger } from './worker/listeners'
import { broadcastStatusTrack, isStatusTrackBroadcast, trackStatus } from './worker/runtime/statusTrack'
import { ServiceJSON } from './worker/runtime/typings'
import { execSync, exec } from 'child_process'
import { mkdirSync, readdirSync } from 'fs'

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

const createDir = (path: string) => {
  try {
    mkdirSync(path)
  } catch(err) {
  }
}

const createV8PerfLogsDirs = () => {
  createDir('/cache/v8-perf')
  createDir('/cache/v8-perf/logs')
  createDir('/cache/v8-perf/dist')
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
  } else if (LINKED) {
    console.log("> Generating v8 profiling...")
    
    const logs = readdirSync('/cache/v8-perf/logs')
    console.log(logs)

    console.log("  Reseting dist folder...")
    execSync('rm -rf /cache/v8-perf/dist/*')

    console.log("  Removing old flamegraph.tar.gz")
    execSync('rm -rf /cache/v8-perf/flamegraph.tar.gz')

    const split = logs[0].split('-')
    split.splice(4,1)
    const newFilename = `${split.join('-')}.log`
    console.log("  Copying v8 log to dist folder...")
    execSync(`cp /cache/v8-perf/logs/${logs[0]} /cache/v8-perf/dist/${newFilename}`)
    
    console.log("  Reset v8 logs folder...")
    execSync('rm -rf /cache/v8-perf/logs/*')

    execSync('/usr/local/data/service/node_modules/@vtex/api/node_modules/0x/cmd.js --visualize-only /cache/v8-perf/dist')

    console.log("Generate flamegraph.tar.gz")
    execSync('tar -czvf /cache/v8-perf/flamegraph.tar.gz -C /cache/v8-perf/dist .')

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

const handleSignal: NodeJS.SignalsListener = (signal) => {
  // Log the Master Process received a signal
  const message = `Master process ${process.pid} received signal ${signal}`
  console.warn(message)
  logger.warn({ message, signal })

  // For each worker, let's try to kill it gracefully
  Object.values(cluster.workers).forEach((worker) => worker?.kill(signal))

  // Let's raise the flag to kill the master process after all workers have died
  handledSignal = signal

  // If the worker refuses to die after some milliseconds, let's force it to die
  setTimeout(() => Object.values(cluster.workers).forEach((worker) => worker?.process.kill('SIGKILL')), 1e3)
  // If master refuses to die after some milliseconds, let's force it to die
  setTimeout(() => process.exit((constants.signals as any)[signal]), 1.5e3)
}

export const startMaster = (service: ServiceJSON) => {
  const { workers: numWorkers } = service

  if (service.deterministicVary) {
    process.env.DETERMINISTIC_VARY = 'true'
  }

  createV8PerfLogsDirs()

  // Setup dubugger
  if (LINKED) {
    cluster.setupMaster({ inspectPort: INSPECT_DEBUGGER_PORT, execArgv: ['--prof', '--logfile=/cache/v8-perf/logs/v8-%p.log'] })
  }

  console.log(`Spawning ${numWorkers} workers`)
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('online', onOnline)
  cluster.on('exit', onExit)
  cluster.on('message', onMessage)

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
}
