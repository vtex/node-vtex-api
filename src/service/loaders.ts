import { cpus } from 'os'
import { join } from 'path'

import { IOClients } from '../clients/IOClients'
import { LINKED, MAX_WORKERS } from '../constants'
import { Service } from './worker/runtime/Service'
import {
  ClientsConfig,
  ParamsContext,
  RawServiceJSON,
  RecorderState,
  ServiceJSON,
} from './worker/runtime/typings'

export const appPath = join(process.cwd(), './service/src/node/')
export const bundlePath = join(appPath, 'index')
export const serviceJsonPath = join(process.cwd(), './service/service.json')

const getWorkers = (workers?: any) => {
  // We need to have only one worker while linking so the debugger
  // works properly
  if (LINKED) {
    return 1
  }
  // If user didn't set workers property, let's use the cpu count
  const workersFromUser = workers && Number.isInteger(workers) ? workers : cpus().length
  // never spawns more than MAX_WORKERS
  return Math.min(workersFromUser, MAX_WORKERS)
}

export const getServiceJSON = (): ServiceJSON => {
  const service: RawServiceJSON = require(serviceJsonPath)
  return {
    ...service,
    workers: getWorkers(service.workers),
  }
}

const defaultClients: ClientsConfig = {
  options: {
    messages: {
      concurrency: 10,
      retries: 2,
      timeout: 1000,
    },
    messagesGraphQL: {
      concurrency: 10,
      retries: 2,
      timeout: 1000,
    },
  },
}

export const getService = (): Service<IOClients, RecorderState, ParamsContext> => {
  const { default: service } = require(bundlePath)
  const { config: { clients } } = service
  service.config.clients = {
    implementation: clients?.implementation ?? IOClients,
    options: {
      ...defaultClients.options,
      ...clients?.options,
    },
  }
  return service
}
