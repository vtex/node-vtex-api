import {
  isNetworkOrIdempotentRequestError,
  isSafeRequestError,
} from 'axios-retry'

export const TIMEOUT_CODE = 'ProxyTimeout'

const printLabel = (e: any, message: string) => {
  if (!e || !e.config || !e.config.label) {
    return
  }
  console.warn(e.config.label, message)
}

export const isNetworkErrorOrRouterTimeout = (e: any) => {
  if (isNetworkOrIdempotentRequestError(e)) {
    printLabel(e, 'Retry from network error')
    return true
  }

  if (
    e &&
    isSafeRequestError(e) &&
    e.response &&
    e.response.data &&
    e.response.data.code === TIMEOUT_CODE
  ) {
    printLabel(e, 'Retry from timeout')
    return true
  }

  return false
}

// Retry on timeout from our end
export const isAbortedOrNetworkErrorOrRouterTimeout = (e: any) => {
  if (e && e.code === 'ECONNABORTED') {
    printLabel(e, 'Retry from abort')
    return true
  }
  return isNetworkErrorOrRouterTimeout(e)
}

export {
  isNetworkOrIdempotentRequestError,
  exponentialDelay,
} from 'axios-retry'
