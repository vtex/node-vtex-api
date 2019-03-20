import {isNetworkOrIdempotentRequestError, isSafeRequestError} from 'axios-retry'

export const TIMEOUT_CODE = 'ProxyTimeout'

export const isNetworkErrorOrRouterTimeout = (e: any) => {
  if (isNetworkOrIdempotentRequestError(e)) {
    console.warn('Retry from network error', e.message)
    return true
  }

  if (e && isSafeRequestError(e) && e.response && e.response.data && e.response.data.code === TIMEOUT_CODE) {
    console.warn('Retry from timeout', e.message)
    return true
  }

  return false
}

// Retry on timeout from our end
export const isAbortedOrNetworkErrorOrRouterTimeout = (e: any) => {
  if (e && e.code === 'ECONNABORTED') {
    return true
  }
  return isNetworkErrorOrRouterTimeout(e)
}

export {isNetworkOrIdempotentRequestError, exponentialDelay} from 'axios-retry'
