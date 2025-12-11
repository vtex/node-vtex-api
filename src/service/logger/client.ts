import { Types } from '@vtex/diagnostics-nodejs'
import { initializeTelemetry } from '../telemetry'

let client: Types.LogClient | undefined
let isInitializing = false
let initPromise: Promise<Types.LogClient> | undefined = undefined

export async function getLogClient(): Promise<Types.LogClient> {

  if (client) {
    return client
  }

  if (initPromise) {
    return initPromise
  }

  isInitializing = true
  initPromise = initializeClient()

  return initPromise
}

async function initializeClient(): Promise<Types.LogClient> {
  try {
    const { logsClient } = await initializeTelemetry()
    client = logsClient
    initPromise = undefined
    return logsClient
  } catch (error) {
    console.error('Failed to initialize logs client:', error)
    initPromise = undefined
    throw error
  } finally {
    isInitializing = false
  }
}
