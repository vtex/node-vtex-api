import Agent from 'agentkeepalive'
import axios, { AxiosInstance } from 'axios'
import {
  addExponentialBackoffResponseInterceptor,
  addTracingPreRequestInterceptor,
  addTracingResponseInterceptor,
} from './interceptors'

export const getConfiguredAxios = (): {
  http: AxiosInstance
  httpAgent: Agent
} => {
  const httpAgent = new Agent({
    freeSocketTimeout: 15 * 1000,
    keepAlive: true,
    maxFreeSockets: 50,
  })

  const http = axios.create({
    httpAgent,
  })

  addTracingPreRequestInterceptor(http)

  addTracingResponseInterceptor(http)
  addExponentialBackoffResponseInterceptor(http)

  return { http, httpAgent }
}
