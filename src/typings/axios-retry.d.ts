declare module 'axios-retry' {
  import {AxiosError, AxiosInstance, AxiosStatic} from 'axios'

  interface IAxiosRetryConfig {
    /**
     * The number of times to retry before failing
     * default: 3
     *
     * @type {number}
     */
    retries?: number,
    /**
     * Defines if the timeout should be reset between retries
     * default: false
     *
     * @type {boolean}
     */
    shouldResetTimeout?: boolean,
    /**
     * A callback to further control if a request should be retried. By default, it retries if the result did not have a response.
     * default: error => !error.response
     *
     * @type {Function}
     */
    retryCondition?: (error: AxiosError) => boolean,
    /**
     * A callback to further control the delay between retry requests. By default there is no delay.
     *
     * @type {Function}
     */
    retryDelay?: (retryCount: number, error: AxiosError) => number
  }

  interface Retry {
    (
      axios: AxiosStatic | AxiosInstance,
      axiosRetryConfig?: IAxiosRetryConfig,
    ): void,
    exponentialDelay: (retryNumber: number) => number
  }
  
  var R: Retry

  export = R
}
