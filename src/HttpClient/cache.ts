import {AxiosInstance, AxiosResponse, AxiosRequestConfig} from 'axios'
import {createWriteStream, createReadStream, outputFile, ensureDir, readFile} from 'fs-extra'
import {Readable, PassThrough} from 'stream'
import * as path from 'path'

const EMPTY = {}

const successOrNotModified = (status: number): boolean =>
  status >= 200 && status < 300 || status === 304

const getFilePath = (etag: string, path: string, gzip: boolean): string =>
 `cache/etags/${etag.replace(/\"/g, '')}${path}${gzip ? '.zip' : ''}`

const copyStream = (source: Readable): PassThrough => {
  const copy = new PassThrough()
  source.pipe(copy)
  return copy
}

const isGzip = (headers: {[key: string]: string}) => {
  return headers['content-type'] === 'application/x-gzip'
}

export const addCacheInterceptors = (http: AxiosInstance, cacheStorage: CacheStorage) => {

  const setCache = async (response: any) => {
    const {data, headers, config: {url, baseURL, cacheFromDisk}} = response
    const {etag} = headers
    if (etag) {
      const filePath = getFilePath(etag, url.replace(baseURL, ''), isGzip(headers))
      cacheStorage.set(url, {
        etag,
        cacheFromDisk,
        filePath,
        response: {data: cacheFromDisk ? {} : data, headers},
      })
    }
  }

  http.interceptors.request.use(async (config: any) => {
    if (config.cacheable) {
      const {data, etag, response, cacheFromDisk, filePath} = cacheStorage.get(config.url) || EMPTY
      if (etag) {
        if (cacheFromDisk) {
          switch (config.responseType) {
            case 'stream':
              response.data = createReadStream(filePath)
              break

            case 'arraybuffer':
              response.data = await readFile(filePath)
              break
          }
        } else {
          response.data = data
        }

        config.headers['if-none-match'] = etag
        config.cached = response
        config.validateStatus = successOrNotModified
      }
    }

    return config
  })

  http.interceptors.response.use(async (response: any) => {
    const {headers, status, data, config: {url, baseURL, cached, cacheFromDisk, responseType}} = response
    const {etag} = headers
    if (status === 304) {
      return cached
    }

    if (etag) {
      if (cacheFromDisk) {
        const filePath = getFilePath(etag, url.replace(baseURL, ''), isGzip(headers))
        await ensureDir(path.dirname(filePath))

        switch (responseType) {
          case 'stream':
            const copy = copyStream(data)
            copy.pipe(createWriteStream(filePath))
            copy.on('end', () => setCache(response))
            break

          case 'arraybuffer':
            await outputFile(filePath, data)
            setCache(response)
            break
        }
      } else {
        setCache(response)
      }
    }

    return response
  })
}

export interface CacheStorage {
  get<T> (key: string): T
  set (key: string, value: any): void
}

export type CacheableRequestConfig = AxiosRequestConfig & {
  url: string,
  cacheable: boolean,
  cached?: any,
  filePath: string,
  cacheFromDisk: boolean,
}

type CacheableResponse = AxiosResponse & {
  config: CacheableRequestConfig,
}
