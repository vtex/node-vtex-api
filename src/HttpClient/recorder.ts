import {AxiosInstance, AxiosResponse} from 'axios'

export const addRecorderInterceptors = (http: AxiosInstance, recorder: Recorder) => {
  http.interceptors.response.use((response: AxiosResponse) => {
    recorder(response.headers)
    return response
  }, (err: any) => {
    if (err.response && err.response.headers && err.response.status === 404) {
      recorder(err.response.headers)
    }
    return Promise.reject(err)
  })
}

export interface Recorder {
  (headers: any): void
}
