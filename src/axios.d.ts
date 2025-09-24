declare module 'axios/index' {}

declare module 'axios' {
  export type AxiosTransformer = (data: any, headers?: any) => any

  export type AxiosAdapter = (config: AxiosRequestConfig) => AxiosPromise<any>

  export interface AxiosBasicCredentials {
    username: string
    password: string
  }

  export interface AxiosProxyConfig {
    host: string
    port: number
    auth?: {
      username: string;
      password: string;
    }
    protocol?: string
  }

  export type Method =
    | 'get' | 'GET'
    | 'delete' | 'DELETE'
    | 'head' | 'HEAD'
    | 'options' | 'OPTIONS'
    | 'post' | 'POST'
    | 'put' | 'PUT'
    | 'patch' | 'PATCH'
    | 'link' | 'LINK'
    | 'unlink' | 'UNLINK'

  export type ResponseType =
    | 'arraybuffer'
    | 'blob'
    | 'document'
    | 'json'
    | 'text'
    | 'stream'

  // Tipos de cabeçalho
  export type RawAxiosRequestHeaders = Record<string, any>
  export type RawAxiosResponseHeaders = Record<string, any>
  export interface AxiosHeaders extends Record<string, any> {
    set(headerName: string, value: string): AxiosHeaders
    get(headerName: string): string | undefined
    delete(headerName: string): boolean
    clear(): AxiosHeaders
    toJSON(): Record<string, any>
    [key: string]: any
  }

  export interface AxiosRequestConfig {
    url?: string
    method?: Method
    baseURL?: string
    transformRequest?: AxiosTransformer | AxiosTransformer[]
    transformResponse?: AxiosTransformer | AxiosTransformer[]
    headers?: RawAxiosRequestHeaders
    params?: any
    paramsSerializer?: (params: any) => string
    data?: any
    timeout?: number
    timeoutErrorMessage?: string
    withCredentials?: boolean
    adapter?: AxiosAdapter
    auth?: AxiosBasicCredentials
    responseType?: ResponseType
    responseEncoding?: string
    xsrfCookieName?: string
    xsrfHeaderName?: string
    onUploadProgress?: (progressEvent: any) => void
    onDownloadProgress?: (progressEvent: any) => void
    maxContentLength?: number
    maxBodyLength?: number
    validateStatus?: (status: number) => boolean
    maxRedirects?: number
    socketPath?: string | null
    httpAgent?: any
    httpsAgent?: any
    proxy?: AxiosProxyConfig | false
    cancelToken?: CancelToken
    decompress?: boolean
    transitional?: any
    signal?: any
    insecureHTTPParser?: boolean
    [key: string]: any // Para permitir qualquer propriedade adicional
  }

  export interface InternalAxiosRequestConfig extends AxiosRequestConfig {
    headers: AxiosHeaders | RawAxiosRequestHeaders
    [key: string]: any // Para permitir propriedades adicionais como 'tracing'
  }

  export interface AxiosResponse<T = any> {
    data: T
    status: number
    statusText: string
    headers: RawAxiosResponseHeaders
    config: AxiosRequestConfig
    request?: any
  }

  // Define AxiosError como uma classe para fazer instanceof funcionar
  export class AxiosError<T = any> extends Error {

    // Métodos estáticos para criar instâncias de AxiosError
    public static from<T = any>(
      error: Error,
      code?: string,
      config?: AxiosRequestConfig,
      request?: any,
      response?: AxiosResponse<T>,
      customProps?: Record<string, any>
    ): AxiosError<T>
    public config: AxiosRequestConfig
    public code?: string
    public request?: any
    public response?: AxiosResponse<T>
    public isAxiosError: boolean
    public status?: number

    constructor(
      message?: string,
      code?: string,
      config?: AxiosRequestConfig,
      request?: any,
      response?: AxiosResponse<T>
    );

    public toJSON(): object
  }

  export interface AxiosPromise<T = any> extends Promise<AxiosResponse<T>> {
  }

  export type CancelStatic = new (message?: string) => Cancel

  export interface Cancel {
    message: string
  }

  export type Canceler = (message?: string) => void

  export interface CancelTokenStatic {
    new (executor: (cancel: Canceler) => void): CancelToken
    source(): CancelTokenSource
  }

  export interface CancelToken {
    promise: Promise<Cancel>
    reason?: Cancel
    throwIfRequested(): void
  }

  export interface CancelTokenSource {
    token: CancelToken
    cancel: Canceler
  }

  export interface AxiosInterceptorManager<V> {
    use(onFulfilled?: (value: V) => V | Promise<V>, onRejected?: (error: any) => any): number
    eject(id: number): void
    clear(): void
  }

  export interface AxiosInstance {
    (config: AxiosRequestConfig): AxiosPromise
    (url: string, config?: AxiosRequestConfig): AxiosPromise
    defaults: AxiosRequestConfig
    interceptors: {
      request: AxiosInterceptorManager<AxiosRequestConfig>;
      response: AxiosInterceptorManager<AxiosResponse>;
    }
    getUri(config?: AxiosRequestConfig): string
    request<T = any, R = AxiosResponse<T>>(config: AxiosRequestConfig): Promise<R>
    get<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>
    delete<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>
    head<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>
    options<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>
    post<T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>
    put<T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>
    patch<T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>
  }

  export interface AxiosStatic extends AxiosInstance {
    Cancel: CancelStatic
    CancelToken: CancelTokenStatic
    create(config?: AxiosRequestConfig): AxiosInstance
    isCancel(value: any): boolean
    all<T>(values: Array<T | Promise<T>>): Promise<T[]>
    spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R
    isAxiosError(payload: any): payload is AxiosError
  }

  const axios: AxiosStatic

  export const AxiosError: {
    readonly prototype: AxiosError;
    readonly ERR_NETWORK: string;
    readonly ERR_BAD_REQUEST: string;
    readonly TIMEOUT_ERROR_CODE: string;
    readonly ERR_BAD_RESPONSE: string;
    readonly ERR_FR_TOO_MANY_REDIRECTS: string;
    readonly ERR_DEPRECATED: string;
    readonly ERR_BAD_OPTION_VALUE: string;
    readonly ERR_CANCELED: string;
    readonly ECONNABORTED: string;
    readonly ETIMEDOUT: string;
    new <T = any>(
      message?: string,
      code?: string,
      config?: AxiosRequestConfig,
      request?: any,
      response?: AxiosResponse<T>
    ): AxiosError<T>;
    from<T = any>(
      error: Error,
      code?: string,
      config?: AxiosRequestConfig,
      request?: any,
      response?: AxiosResponse<T>,
      customProps?: Record<string, any>
    ): AxiosError<T>;
  }

  export default axios
}
