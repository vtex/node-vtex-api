import {isNetworkError} from 'axios-retry'

const TIMEOUT_CODE = 'ProxyTimeout'

export const isNetworkErrorOrRouterTimeout = (e: any) => {
  if (isNetworkError(e)) {
    console.warn('Retry from network error', e.message)
    return true
  }

  if (e && e.response && e.response.data && e.response.data.code === TIMEOUT_CODE) {
    console.warn('Retry from timeout', e.message)
    return true
  }

  return false
}

export {exponentialDelay} from 'axios-retry'
