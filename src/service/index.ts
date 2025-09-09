import { initializeTelemetry } from './telemetry'
import cluster from 'cluster'

import { HTTP_SERVER_PORT } from '../constants'
import { MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { getServiceJSON } from './loaders'
import { LogLevel, logOnceToDevConsole } from './logger'

export const startApp = async () => {
  await initializeTelemetry()
  
  // Initialize global.metrics for both master and worker processes
  global.metrics = new MetricsAccumulator()
  
  const serviceJSON = getServiceJSON()
  try {
    // if it is a master process then call setting up worker process
    if(cluster.isMaster) {
      const { startMaster } = await import('./master')
      startMaster(serviceJSON)
    } else {
      // to setup server configurations and share port address for incoming requests
      const { startWorker } = await import('./worker')
      const app = await startWorker(serviceJSON)
      app.listen(HTTP_SERVER_PORT)
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
      metrics: MetricsAccumulator
    }
  }
}

