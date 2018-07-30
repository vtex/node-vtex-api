import {AxiosInstance, AxiosResponse} from 'axios'

export const addNotFoundInterceptors = (http: AxiosInstance) => {
  http.interceptors.response.use((response: AxiosResponse) => {
    if (response && response.status === 404) {
      response.data = null
    }
    return response
  })
}
