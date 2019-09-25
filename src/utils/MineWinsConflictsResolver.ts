import { AxiosResponse } from 'axios'
import { Base64 } from 'js-base64'
import { eqProps, equals } from 'ramda'
import { isArray, isObject } from 'util'
import { ConflictsResolver, VBase, VBaseConflict, VBaseConflictData } from '../clients/VBase'

type Configuration = Record<string, object | object[]> | object[]

export class MineWinsConflictsResolver implements ConflictsResolver {
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

  public async resolve() {
    return await this.client.getConflicts<AxiosResponse<VBaseConflictData[]>>(this.bucket).then((data) => {
      const { data: conflicts }: { data: VBaseConflictData[] } = data
      const selectedConflict = conflicts.find(conflict => conflict.path === this.filePath)
      if (!selectedConflict) {
        return {}
      }

      selectedConflict.base.parsedContent = this.parseConflict(selectedConflict.base)
      selectedConflict.master.parsedContent = this.parseConflict(selectedConflict.master)
      selectedConflict.mine.parsedContent = this.parseConflict(selectedConflict.mine)
      const resolved = this.resolveConflictMineWins(selectedConflict)
      return resolved
    })
  }

  protected mergeMineWins(base: Configuration, master: Configuration, mine: Configuration) {
    if (isArray(master)) {
      return this.mergeMineWinsArray(base as object[], master, mine as object[])
    } else if (isObject(master)) {
      return this.mergeMineWinsObject(base as Record<string, object | object[]>, master, mine as Record<string, object | object[]>)
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
      return {}
    }

    const { base, master, mine, path } = conflict
    this.mergeMineWins(base.parsedContent, master.parsedContent, mine.parsedContent)
    const mergedContent = {
      content: Base64.encode(this.serializeContentByMimetype(mine.parsedContent, conflict.mine.mimeType)),
      mimeType: conflict.mine.mimeType,
    }
    this.client.resolveConflict(this.bucket, path, mergedContent)

    return mine.parsedContent
  }

  private mergeMineWinsObject(base: Record<string, object | object[]>, master: Record<string, object | object[]>, mine: Record<string, object | object[]>) {
    const merged = { ...master, ...mine }
    Object.entries(merged).forEach(([key, value]) => {
      if (master[key] == null && base[key] != null && equals(value, base[key])) {
        delete merged[key] // value deleted from master with no conflict
      } else if (isArray(value)) {
        this.mergeMineWinsArray(base[key] as object[], master[key] as object[], value)
      } else if (isObject(value)) {
        this.mergeMineWins(base[key] as Configuration, master[key] as Configuration, value as Configuration)
      }
    })
    return merged
  }

  private mergeMineWinsArray(base: object[], master: object[], mine: object[]) {
    this.removeMasterDeletedElements(base, master, mine)
    this.appendMasterAddedElements(master, mine)
    return mine
  }

  private removeMasterDeletedElements(base: object[], master: object[], mine: object[]) {
    base.forEach(baseItem => {
      const foundInMaster = this.isObjectInArray(baseItem, master)
      if (!foundInMaster) {
        const foundInMine = mine.findIndex(mineItem => equals(mineItem, baseItem))
        if (foundInMine > -1) {
          mine.splice(foundInMine, 1)
        }
      }
    })
  }

  private isObjectInArray(obj: object, array: object[]) {
    return array.find(item => equals(item, obj))
  }

  private appendMasterAddedElements(master: object[], mine: object[]) {
    master.forEach(item => {
      if (this.shouldAddToArray(item, mine)) {
        mine.push(item)
      }
    })
  }

  private shouldAddToArray(item: object, array: object[]) {
    return this.comparableKeys
      ? !array.some(mineItem => this.comparableKeys!.some(key => eqProps(key, item, mineItem)))
      : !array.some(mineItem => equals(mineItem, item))
  }
}
