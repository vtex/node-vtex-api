import { ChildProcess, exec, ExecException } from 'child_process'

import { MAX_MEMCACHED_RESTARTS } from '../../constants'
import { logger } from '../worker/listeners'
import { ServiceJSON } from '../worker/runtime/typings'

export let memCached: ChildProcess | null = null
let memCachedRestarts = 0

const onExit = (service: ServiceJSON) => (code: number, signal: NodeJS.Signals) => {
  startMemCached(service)
  console.log(`memcached exit with signal ${code}: ${signal}`)
}

const onError = (service: ServiceJSON) => (err: Error) => {
  startMemCached(service)
  console.log(`memcached error: ${err}`)
}

const afterExit = (error: ExecException | null, stdout: string, stderr: string) => {
  if (error) {
    // Do not restart memcached after exiting with error
    memCachedRestarts = MAX_MEMCACHED_RESTARTS
    logger.error(error)
  }
  else if (stdout) {
    console.log(stdout)
  }
  else if (stderr) {
    console.error(stderr)
  }
  else {
    logger.error(`something wild happened ${{error, stdout, stderr}}`)
  }
}

export const startMemCached = (service: ServiceJSON) => {
  const { memory } = service
  if (memCachedRestarts < MAX_MEMCACHED_RESTARTS) {
    memCachedRestarts += 1
    memCached = exec(`memcached -vv -u memcached -s /tmp/memcached.sock -m ${memory}`, afterExit)
    memCached.on('exit', onExit(service))
    memCached.on('error', onError(service))
  }
}
