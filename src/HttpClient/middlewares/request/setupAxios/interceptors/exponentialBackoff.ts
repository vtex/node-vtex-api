import { AxiosInstance } from 'axios'
import { isAbortedOrNetworkErrorOrRouterTimeout } from '../../../../../utils/retry'
import { RequestConfig } from '../../../../typings'

function fixConfig(axiosInstance: AxiosInstance, config: RequestConfig) {
  if (axiosInstance.defaults.httpAgent === config.httpAgent) {
    delete config.httpAgent
  }
  if (axiosInstance.defaults.httpsAgent === config.httpsAgent) {
    delete config.httpsAgent
  }
}

const exponentialDelay = (
  initialBackoffDelay: number,
  exponentialBackoffCoefficient: number,
  retryNumber: number
) => {
  const delay =
    initialBackoffDelay *
    Math.pow(exponentialBackoffCoefficient, retryNumber - 1)
  const randomSum = delay * 0.2 * Math.random()
  return delay + randomSum
}

// A lot of this code is based on:
// https://github.com/softonic/axios-retry/blob/ffd4327f31d063522e58c525d28d4c5053d0ea7b/es/index.js#L109
const onResponseError = (http: AxiosInstance) => (error: any) => {
  if (error.config == null) {
    return Promise.reject(error)
  }

  const config = error.config as RequestConfig

  if (config.retries == null || config.retries === 0) {
    return Promise.reject(error)
  }
  const {
    initialBackoffDelay = 200,
    exponentialBackoffCoefficient = 2,
    exponentialTimeoutCoefficient,
  } = config

  const retryCount = config.retryCount || 0
  const shouldRetry =
    isAbortedOrNetworkErrorOrRouterTimeout(error) && retryCount < config.retries
  if (shouldRetry) {
    config.retryCount = retryCount + 1
    const delay = exponentialDelay(
      initialBackoffDelay,
      exponentialBackoffCoefficient,
      config.retryCount
    )


    // Axios fails merging this configuration to the default configuration because it has an issue
    // with circular structures: https://github.com/mzabriskie/axios/issues/370
    fixConfig(http, config)

    config.timeout = exponentialTimeoutCoefficient
      ? (config.timeout as number) * exponentialTimeoutCoefficient
      : config.timeout
    config.transformRequest = [data => data]
    
    config.tracing!.rootSpan!.log({ event: 'retryable-request-fail', retryCount: config.retryCount, retryInMs: delay })
    return new Promise(resolve => setTimeout(() => resolve(http(config)), delay))
  }
  return Promise.reject(error)
}

export const addExponentialBackoffResponseInterceptor = (
  http: AxiosInstance
) => {
  http.interceptors.response.use(undefined, onResponseError(http))
}
