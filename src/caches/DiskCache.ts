import { CacheLayer } from './CacheLayer'
import { DiskStats } from './typings'

import { outputJSON, pathExists, readJSON } from 'fs-extra'
import { join } from 'path'
import * as ReadWriteLock from 'rwlock'

export class DiskCache<V> implements CacheLayer<string, V>{

  private hits = 0
  private total = 0
  private lock: ReadWriteLock

  constructor(private cachePath: string, private readFile=readJSON, private writeFile=outputJSON) {
    this.lock = new ReadWriteLock()
  }

  public has = async (key: string): Promise<boolean> => {
    const pathKey = this.getPathKey(key)
    return await pathExists(pathKey)
  }

  public getStats = (name='disk-cache'): DiskStats => {
    const stats = {
      hits: this.hits,
      name,
      total: this.total,
    }
    this.hits = 0
    this.total = 0
    return stats
  }

  public get = async (key: string): Promise<V | void>  => {
    const pathKey = this.getPathKey(key)
    try {
      this.total += 1
      const data = await new Promise<V>(resolve => {
        this.lock.readLock(key, async (release: () => void) => {
          const fileData = await this.readFile(pathKey)
          release()
          resolve(fileData)
        })
      })
      this.hits += 1
      return data
    } catch (e) {
      return undefined
    }
  }

  public set = async (key: string, value: V) => {
    const pathKey = this.getPathKey(key)
    await new Promise<void>(resolve => {
      this.lock.writeLock(key, async (release: () => void) => {
        const writePromise = await this.writeFile(pathKey, value)
        resolve(writePromise)
        release()
      })
    })
    return true
  }

  private getPathKey = (key: string) => join(this.cachePath, key)
}