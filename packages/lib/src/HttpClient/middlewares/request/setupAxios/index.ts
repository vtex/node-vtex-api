import axios from 'axios'
import { HttpAgentSingleton } from '../HttpAgentSingleton'
import {
  addExponentialBackoffResponseInterceptor,
  addTracingPreRequestInterceptor,
  addTracingResponseInterceptor,
} from './interceptors'

export const getConfiguredAxios = () => {
  const httpAgent = HttpAgentSingleton.getHttpAgent()
  const http = axios.create({
    httpAgent,
  })

  addTracingPreRequestInterceptor(http)

  // Do not change this order, otherwise each request span will
  // wait all retries to finish before finishing the span 
  addTracingResponseInterceptor(http)
  addExponentialBackoffResponseInterceptor(http)

  return http
}
