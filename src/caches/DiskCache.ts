import { CacheLayer } from './CacheLayer'
import { DiskStats } from './typings'

import { outputJSON, pathExistsSync, readJSON } from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

export class DiskCache<V> implements CacheLayer<string, V> {
  private hits = 0
  private total = 0
  private lock: ReadWriteLock

  constructor(private cachePath: string, private readFile = readJSON, private writeFile = outputJSON) {
    this.lock = new ReadWriteLock()
  }

  public has = (key: string): boolean => {
    const pathKey = this.getPathKey(key)
    return pathExistsSync(pathKey)
  }

  public getStats = (name = 'disk-cache'): DiskStats => {
    const stats = {
      hits: this.hits,
      name,
      total: this.total,
    }
    this.hits = 0
    this.total = 0
    return stats
  }

  public get = async (key: string): Promise<V | void> => {
    const pathKey = this.getPathKey(key)
    this.total += 1
    const data = await new Promise<V>(resolve => {
      this.lock.readLock(key, async (release: () => void) => {
        try {
          const fileData = await this.readFile(pathKey)
          release()
          this.hits += 1
          resolve(fileData)
        } catch (e) {
          release()
          resolve(undefined)
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
