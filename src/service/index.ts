import { wrapHttpAndHttps } from '@tiagonapoli/http-timer-shim'
import cluster from 'cluster'

import { HTTP_SERVER_PORT } from '../constants'
import { getServiceJSON } from './loaders'
import { LogLevel, logOnceToDevConsole } from './logger'
import { startMaster } from './master'
import { startWorker } from './worker'

export const startApp = () => {
  const serviceJSON = getServiceJSON()
  wrapHttpAndHttps()
  
  try {
    // if it is a master process then call setting up worker process
    if(cluster.isMaster) {
      startMaster(serviceJSON)
    } else {
      // to setup server configurations and share port address for incoming requests
      startWorker(serviceJSON).listen(HTTP_SERVER_PORT)
    }
  } catch (err) {
    logOnceToDevConsole(err.stack || err.message, LogLevel.Error)
    process.exit(2)
  }
}

export { appPath } from './loaders'

