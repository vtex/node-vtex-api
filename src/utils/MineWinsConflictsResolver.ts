import { AxiosResponse } from 'axios'
import { Base64 } from 'js-base64'
import { eqProps, equals } from 'ramda'
import { isArray, isObject } from 'util'
import { Logger } from './../service/logger/logger'

import { ConflictsResolver, VBase, VBaseConflict, VBaseConflictData } from '../clients/infra/VBase'

type Configuration = Record<string, ConfigurationData | ConfigurationData[] | object> | ConfigurationData[]
type ConfigurationData = Record<string, object>

export class MineWinsConflictsResolver<T> implements ConflictsResolver<T> {
  /***
   * Take mine and merge with master keys that have no conflict
   * We use base to decide wether a key was deleted or not
   */

  private client: VBase
  private bucket: string
  private filePath: string
  private comparableKeys: string[] | undefined

  constructor(client: VBase, bucket: string, filePath: string, comparableKeys?: string[]) {
    this.client = client
    this.bucket = bucket
    this.filePath = filePath
    this.comparableKeys = comparableKeys
  }

  public async resolve(logger?: Logger) {
    return await this.client.getConflicts<AxiosResponse<VBaseConflictData[]>>(this.bucket).then((data) => {
      const { data: conflicts }: { data: VBaseConflictData[] } = data
      const selectedConflict = conflicts.find((conflict) => conflict.path === this.filePath)

      if (!selectedConflict) {
        throw {
          message: 'No conflict could be found.',
          status: 404,
        }
      }

      selectedConflict.base.parsedContent = this.parseConflict(selectedConflict.base)
      selectedConflict.master.parsedContent = this.parseConflict(selectedConflict.master)
      selectedConflict.mine.parsedContent = this.parseConflict(selectedConflict.mine)
      const resolved = this.resolveConflictMineWins(selectedConflict)

      return resolved as any
    })
  }

  public async resolveAll() {
    return await this.client.getConflicts<AxiosResponse<VBaseConflictData[]>>(this.bucket).then((data) => {
      const { data: conflicts }: { data: VBaseConflictData[] } = data

      const resolved = conflicts.map((conflict) => {
        conflict.base.parsedContent = this.parseConflict(conflict.base)
        conflict.master.parsedContent = this.parseConflict(conflict.master)
        conflict.mine.parsedContent = this.parseConflict(conflict.mine)
        return this.resolveConflictMineWins(conflict)
      })

      return resolved as any
    })
  }

  protected mergeMineWins(base: Configuration, master: Configuration, mine: Configuration) {
    if (isArray(master)) {
      return this.mergeMineWinsArray((base || []) as ConfigurationData[], master, (mine || []) as ConfigurationData[])
    } else if (isObject(master)) {
      return this.mergeMineWinsObject((base || {}) as ConfigurationData, master, (mine || {}) as ConfigurationData)
    }
    return mine ? mine : master
  }

  private parseConflict(conflict: VBaseConflict) {
    if (!conflict || !conflict.content) {
      return {}
    }
    return this.parseContentByMimetype(Base64.decode(conflict.content), conflict.mimeType)
  }

  private serializeContentByMimetype(content: string, mimetype: string) {
    if (mimetype === 'application/json') {
      return JSON.stringify(content)
    }
    return content
  }

  private parseContentByMimetype(content: string, mimetype: string) {
    if (mimetype === 'application/json') {
      return JSON.parse(content)
    }
    return content
  }

  private resolveConflictMineWins(conflict: VBaseConflictData) {
    if (!conflict) {
      throw {
        message: 'No conflict could be found.',
        status: 404,
      }
    }

    const { base, master, mine, path } = conflict
    const merged = this.mergeMineWins(base.parsedContent, master.parsedContent, mine.parsedContent)

    const mergedContent = {
      content: Base64.encode(this.serializeContentByMimetype(merged as any, conflict.mine.mimeType)),
      mimeType: conflict.mine.mimeType,
    }

    this.client.resolveConflict(this.bucket, path, mergedContent)

    return merged
  }

  private mergeMineWinsObject(base: ConfigurationData, master: ConfigurationData, mine: ConfigurationData) {
    const merged = { ...master, ...mine }

    Object.entries(merged).forEach(([key, value]) => {
      if (master[key] == null && base && base[key] != null && equals(value, base[key])) {
        delete merged[key] // value deleted from master with no conflict
      } else if (base[key] && master[key] && !mine[key]) {
        delete merged[key] // value deleted from mine
      } else if (isArray(value)) {
        merged[key] = this.mergeMineWinsArray(
          (base[key] || []) as ConfigurationData[],
          (master[key] || []) as ConfigurationData[],
          value
        )
      } else if (isObject(value)) {
        merged[key] = this.mergeMineWins(
          (base[key] || {}) as Configuration,
          (master[key] || {}) as Configuration,
          (value || {}) as Configuration
        )
      }
    })

    return merged
  }

  private mergeMineWinsArray(base: ConfigurationData[], master: ConfigurationData[], mine: ConfigurationData[]) {
    this.removeMasterDeletedElements(base, master, mine)
    this.appendMasterAddedElements(base, master, mine)
    return mine
  }

  private removeMasterDeletedElements(
    base: ConfigurationData[],
    master: ConfigurationData[],
    mine: ConfigurationData[]
  ) {
    base.forEach((baseItem) => {
      const foundInMaster = this.isObjectInArray(baseItem, master)

      if (!foundInMaster) {
        const foundInMine = mine.findIndex((mineItem) => equals(mineItem, baseItem))
        if (foundInMine > -1) {
          mine.splice(foundInMine, 1)
        }
      }
    })
  }

  private isObjectInArray(obj: Configuration, array: ConfigurationData[]) {
    return array.find((item) => equals(item, obj))
  }

  private appendMasterAddedElements(base: ConfigurationData[], master: ConfigurationData[], mine: ConfigurationData[]) {
    master.forEach((item) => {
      if (this.shouldAddToMine(item, base, mine)) {
        mine.push(item)
      }
    })
  }

  private shouldAddToMine(item: ConfigurationData, base: ConfigurationData[], mine: ConfigurationData[]) {
    if (this.comparableKeys && Object.keys(item).some((key) => this.comparableKeys!.includes(key))) {
      return (
        !mine.some((mineItem) => this.comparableKeys!.some((key) => eqProps(key, item, mineItem))) &&
        !base.some((baseItem) => equals(baseItem, item))
      )
    }

    return !mine.some((mineItem) => equals(mineItem, item)) && !base.some((baseItem) => equals(baseItem, item))
  }
}
