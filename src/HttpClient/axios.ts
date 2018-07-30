import axios, {AxiosInstance} from 'axios'
import * as retry from 'axios-retry'

export const createInstance = (baseURL: string, headers: Record<string, string>, timeout: number, validateStatus: (status: number) => boolean): AxiosInstance => {
  const http = axios.create({
    baseURL,
    headers,
    maxRedirects: 0, // Do not follow redirects
    timeout,
    validateStatus,
  })
  retry(http)
  http.interceptors.response.use(response => response, (err: any) => {
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
