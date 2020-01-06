import cluster from 'cluster'
import { constants } from 'os'

import { logger } from '../worker/listeners'
import { ServiceJSON } from '../worker/runtime/typings'
import { memCached, startMemCached } from './memcached'
import { setHandledSignal, startWorkers } from './worker'

const handleSignal: NodeJS.SignalsListener = signal => {
  // Log the Master Process received a signal
  const message = `Master process ${process.pid} received signal ${signal}`
  console.warn(message)
  logger.warn({message, signal})

  // For each worker, let's try to kill it gracefully
  Object.values(cluster.workers).forEach(worker => worker?.kill(signal))

  // Let's kill memCached
  memCached?.kill(signal)

  // Let's raise the flag to kill the master process after all workers have died
  setHandledSignal(signal)

  // If the worker refuses to die after some milliseconds, let's force it to die
  setTimeout(() => Object.values(cluster.workers).forEach(worker => worker?.process.kill('SIGKILL')), 1e3)
  // If master refuses to die after some milliseconds, let's force it to die
  setTimeout(() => process.exit(constants.signals[signal]), 1.5e3)
}

export const startMaster = (service: ServiceJSON) => {
  console.log('Starting memcached instance')
  startMemCached(service)

  console.log('Starting workers')
  startWorkers(service)

  // Attaches signal handlers
  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
}
