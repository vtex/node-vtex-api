import axios, {AxiosInstance, AxiosRequestConfig} from 'axios'
import * as retry from 'axios-retry'
import {Readable} from 'stream'

const DEFAULT_TIMEOUT_MS = 10000
const noTransforms = [(data: any) => data]

const createAxiosInstance = (baseURL: string, headers: Record<string, string>, timeout: number) => {
  const http = axios.create({baseURL, headers, timeout})
  retry(http)
  http.interceptors.response.use(response => response, (err: any) => {
    if (err.response && err.response.config) {
      const {url, method} = err.response.config
      console.log(`Error calling ${method.toUpperCase()} ${url}`)
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

const rootURL = (service: string, opts: InstanceOptions): string => {
  const {region, endpoint} = opts
  if (endpoint) {
    return 'http://' + endpoint
  }

  if (region) {
    return `http://${service}.${region}.vtex.io`
  }

  throw new Error('Missing required: should specify either {region} or {endpoint}')
}

const workspaceURL = (service: string, opts: InstanceOptions): string => {
  const {account, workspace} = opts
  if (!account || !workspace) {
    throw new Error('Missing required arguments: {account, workspace}')
  }

  return rootURL(service, opts) + `/${account}/${workspace}`
}

export class HttpClient {
  private http: AxiosInstance

  private constructor (opts: ClientOptions) {
    const {baseURL, authToken, authType, userAgent, timeout = DEFAULT_TIMEOUT_MS} = opts
    const headers = {
      Authorization: `${authType} ${authToken}`,
      'User-Agent': userAgent,
    }

    this.http = createAxiosInstance(baseURL, headers, timeout)
  }

  static forWorkspace (service: string, opts: InstanceOptions): HttpClient {
    const {authToken, userAgent, timeout} = opts
    return new HttpClient({
      baseURL: workspaceURL(service, opts),
      authType: AuthType.bearer,
      authToken,
      userAgent,
      timeout,
    })
  }

  static forRoot (service: string, opts: InstanceOptions): HttpClient {
    const {authToken, userAgent, timeout} = opts
    return new HttpClient({
      baseURL: rootURL(service, opts),
      authType: AuthType.bearer,
      authToken,
      userAgent,
      timeout,
    })
  }

  static forLegacy (endpoint: string, opts: LegacyInstanceOptions): HttpClient {
    const {authToken, userAgent, timeout} = opts
    return new HttpClient({
      baseURL: endpoint,
      authType: AuthType.token,
      authToken,
      userAgent,
      timeout,
    })
  }

  get = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return this.http.get(url, config).then(response => response.data as T)
  }

  getBuffer = (url: string, config: AxiosRequestConfig = {}): Promise<{data: Buffer, headers: any}> => {
    const bufferConfig = {...config, responseType: 'arraybuffer', transformResponse: noTransforms}
    return this.http.get(url, bufferConfig)
  }

  getStream = (url: string, config: AxiosRequestConfig = {}): Promise<Readable> => {
    const streamConfig = {...config, responseType: 'stream', transformResponse: noTransforms}
    return this.http.get(url, streamConfig).then(response => response.data as Readable)
  }

  put = <T = void>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return this.http.put(url, data, config).then(response => response.data as T)
  }

  post = <T = void>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return this.http.post(url, data, config).then(response => response.data as T)
  }

  delete = (url: string, config?: AxiosRequestConfig): Promise<void> => {
    return this.http.delete(url, config).then(() => {})
  }
}

export type InstanceOptions = {
  authToken: string,
  userAgent: string,
  account: string,
  workspace: string,
  region?: string,
  endpoint?: string,
  timeout?: number,
}

export type LegacyInstanceOptions = {
  authToken: string,
  userAgent: string,
  timeout?: number,
  accept?: string,
}

enum AuthType {
  bearer = 'bearer',
  token = 'token',
}

type ClientOptions = {
  authType: AuthType,
  authToken: string,
  userAgent: string
  baseURL: string,
  timeout?: number,
}
