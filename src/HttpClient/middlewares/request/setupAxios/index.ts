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

  addTracingResponseInterceptor(http)
  addExponentialBackoffResponseInterceptor(http)

  return http
}
