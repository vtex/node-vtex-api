import cluster from 'cluster'

import { HTTP_SERVER_PORT } from '../constants'
import { DiagnosticsMetrics } from '../metrics/DiagnosticsMetrics'
import { getServiceJSON } from './loaders'
import { LogLevel, logOnceToDevConsole } from './logger'
import { startMaster } from './master'
import { initializeTelemetry } from './telemetry'
import { startWorker } from './worker'

export const startApp = async () => {
  await initializeTelemetry()

  global.diagnosticsMetrics = new DiagnosticsMetrics()

  const serviceJSON = getServiceJSON()
  try {
    // if it is a master process then call setting up worker process
    if(cluster.isMaster) {
      startMaster(serviceJSON)
    } else {
      // to setup server configurations and share port address for incoming requests
      startWorker(serviceJSON).listen(HTTP_SERVER_PORT)
    }
  } catch (err: any) {
    logOnceToDevConsole(err.stack || err.message, LogLevel.Error)
    process.exit(2)
  }
}

export { appPath } from './loaders'

declare global {
  namespace NodeJS {
    interface Global {
      diagnosticsMetrics: DiagnosticsMetrics
    }
  }
}
