import {AxiosInstance, AxiosResponse} from 'axios'

export const addRecorderInterceptors = (http: AxiosInstance, recorder: Recorder) => {
  http.interceptors.response.use((response: AxiosResponse) => {
    recorder(response)
    return response
  })
}

export interface Recorder {
  (headers: any): void
}
