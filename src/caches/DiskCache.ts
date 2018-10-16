import { CacheLayer } from './CacheLayer'

import { outputJSON, pathExists, readJSON } from 'fs-extra'
import { join } from 'path'

export class DiskCache<V> implements CacheLayer<string, V>{

  private hits = 0
  private total = 0

  constructor(private cachePath: string, private readFile=readJSON, private writeFile=outputJSON) {}

  public has = async (key: string): Promise<boolean> => {
    const cacheKey = this.getCacheKey(key)
    return await pathExists(cacheKey)
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
    const cacheKey = this.getCacheKey(key)
    try {
      this.total += 1
      const data = await this.readFile(cacheKey)
      this.hits += 1
      return data
    } catch (e) {
      return undefined
    }
  }

  public set = async (key: string, json: V) => {
    const cacheKey = this.getCacheKey(key)
    await this.writeFile(cacheKey, json)
    return true
  }

  private getCacheKey = (key: string) => join(this.cachePath, key)
}

// tslint:disable-next-line:interface-over-type-literal
export type DiskStats = {
  hits: number,
  total: number,
  name: string,
}