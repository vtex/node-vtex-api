declare module 'axios-retry' {
  import {AxiosInstance} from 'axios'

  interface Retry {
    (instance: AxiosInstance): void
  }

  var R: Retry

  export = R
}
