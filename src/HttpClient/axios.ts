import axios, {AxiosInstance} from 'axios'
import * as retry from 'axios-retry'

export const createInstance = (baseURL: string, headers: Record<string, string>, timeout: number): AxiosInstance => {
  const http = axios.create({
    baseURL,
    headers,
    timeout,
    validateStatus: status => (status >= 200 && status < 300) || status === 304,
  })
  retry(http)
  http.interceptors.response.use(response => response, (err: any) => {
    if (err.response && err.response.config) {
      const {url, method} = err.response.config
    }
    try {
      delete err.response.request
      delete err.response.config
      delete err.config.res
      delete err.config.data
    } catch (e) {}
    return Promise.reject(err)
  })

  return http
}
