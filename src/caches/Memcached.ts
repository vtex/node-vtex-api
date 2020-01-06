import Memcached from 'memcached'

import { MEMCACHED_PORT } from './../constants'
import { CacheLayer } from './CacheLayer'
import { FetchResult } from './typings'

const TWO_SECONDS_MS = 2 * 1000

const server = new Memcached(`127.0.0.1:${MEMCACHED_PORT}`)

server.on('failure', (err) => console.error('failure', {err}))
server.on('issue', (err) => console.error('issue', {err}))
server.on('reconnecting', (err) => console.error('reconnecting', {err}))
server.on('reconnect', (err) => console.error('reconnect', {err}))
server.on('remove', (err) => console.error('remove', {err}))

export class MemCached<K extends string, V> implements CacheLayer<K, V> {
  private defaultMaxAge: number

  constructor(options: {maxAge: number | null} | null) {
    this.defaultMaxAge = options?.maxAge || TWO_SECONDS_MS
  }

  public get(key: K, fetcher?: () => Promise<FetchResult<V>>): void | V | Promise<void | V> {
    return new Promise((resolve, reject) => {
      server.get(key, (err, data) => {
        if (err) {
          reject(err)
        }
        if (!data && typeof fetcher === 'function') {
          fetcher().then(({value, maxAge}) => {
            this.set(key, value, maxAge)
            resolve(value)
          }).catch(reject)
          return
        }
        resolve(data)
      })
    })
  }

  public has(key: K): boolean | Promise<boolean> {
    return new Promise((resolve, reject) => {
      server.get(key, (err, data) => {
        if (err) {
          reject(err)
        }
        resolve(!!data)
      })
    })
  }

  public set(key: K, value: V, maxAge?: number | void): boolean | Promise<boolean> {
    const lifetime = maxAge || this.defaultMaxAge
    return new Promise((resolve, reject) => {
      server.set(key, value, lifetime, (err, result) => {
        if (err || !result) {
          reject(err || result)
        }
        resolve(result)
      })
    })
  }

  public getStats?(name?: string) {
    return new Promise((resolve, reject) => {
      server.stats((err, stats) => {
        if (err) {
          reject(err)
        }
        console.log({stats})
        resolve(stats)
      })
    })
  }
}
