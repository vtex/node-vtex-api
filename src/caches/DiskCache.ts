import { CacheLayer } from './CacheLayer'
import { CumulativeStats, DiskStats } from './typings'
import { WindowedCounters } from './WindowedCounters'

import { outputJSON, pathExistsSync, readJSON } from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

export class DiskCache<V> implements CacheLayer<string, V>{

  private readonly counters = new WindowedCounters()
  private lock: ReadWriteLock

  constructor(private cachePath: string, private readFile=readJSON, private writeFile=outputJSON) {
    this.lock = new ReadWriteLock()
  }

  public has = (key: string): boolean => {
    const pathKey = this.getPathKey(key)
    return pathExistsSync(pathKey)
  }

  public getStats = (name='disk-cache'): DiskStats => {
    const { hits, total } = this.counters.windowed()
    return { hits, name, total }
  }

  public getCumulativeStats = (): CumulativeStats => {
    const { hits, misses, total } = this.counters.cumulative()
    return { hits, misses, total }
  }

  public get = async (key: string): Promise<V | void>  => {
    const pathKey = this.getPathKey(key)
    this.counters.countRead()
    const data = await new Promise<V | undefined>(resolve => {
      this.lock.readLock(key, async (release: () => void) => {
        try {
          const fileData = await this.readFile(pathKey)
          release()
          this.counters.countHit()
          resolve(fileData)
        } catch (e) {
          release()
          this.counters.countMiss()
          resolve(null as unknown as V)
        }
      })
    })
    return data
  }

  public set = async (key: string, value: V) => {
    const pathKey = this.getPathKey(key)
    const failure = await new Promise<void | boolean>(resolve => {
      this.lock.writeLock(key, async (release: () => void) => {
        try {
          const writePromise = await this.writeFile(pathKey, value)
          release()
          resolve(writePromise)
        } catch (e) {
          release()
          resolve(true)
        }
      })
    })
    return !failure
  }

  private getPathKey = (key: string) => join(this.cachePath, key)
}
