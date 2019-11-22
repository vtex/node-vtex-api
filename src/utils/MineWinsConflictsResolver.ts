import { AxiosResponse } from 'axios'
import { applyChange, applyDiff, diff, Diff, DiffArray, DiffNew } from 'deep-diff'
import { Base64 } from 'js-base64'
import { equals, lensPath, view } from 'ramda'

enum Change {
  EDIT = 'E',
  NEW = 'N',
  DELETE = 'D',
  ARRAY = 'A',
}

import { ConflictsResolver, VBase, VBaseConflict, VBaseConflictData } from '../clients/VBase'

type Configuration = Record<string, ConfigurationData | ConfigurationData[] | object> | ConfigurationData[]
type ConfigurationData = Record<string, object>

export class MineWinsConflictsResolver implements ConflictsResolver {
  /***
   * Take mine and merge with master keys that have no conflict
   * We use base to decide whether a key was deleted or not
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
    return await this.client.getConflicts<AxiosResponse<VBaseConflictData[]>>(this.bucket).then(data => {
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
    const baseCopy = JSON.parse(JSON.stringify(base))
    applyDiff(baseCopy, master)
    const difference = diff(mine, baseCopy)

    if (difference) {
      difference.forEach(change => {
        if (change.kind === Change.EDIT || change.kind === Change.DELETE) {
          this.applyEdit(change, change.path!, baseCopy, base, mine)
        } else if (change.kind === Change.NEW) {
          this.applyAdd(change, change.path!, baseCopy, base, mine)
        } else if (change.kind === Change.ARRAY) {
          this.applyArrayChange(change, baseCopy, base, mine)
        }
      })
    }
    return mine
  }

  private applyAdd<T>(change: Diff<T, any>, path: Array<string | number>, source: T, base: T, mine: T) {
    const baseValue = view(lensPath(path), base)
    const mineValue = view(lensPath(path), mine)
    const sourceValue = view(lensPath(path), source)
    if (baseValue == null && !this.hasSameComparableKeyAndValue(path, sourceValue, mineValue)) {
      applyChange(mine, source, change)
    }
  }

  private hasSameComparableKeyAndValue<T>(path: Array<string | number>, sourceValue: T, comparableValue: T) {
    return this.comparableKeys && path.some(key => this.comparableKeys!.includes(key.toString())) && equals(sourceValue, comparableValue)
  }

  private applyEdit<T>(change: Diff<T, any>, path: string | number[], source: T, base: T, mine: T) {
    const baseValue = view(lensPath(path), base)
    const mineValue = view(lensPath(path), mine)
    if (equals(baseValue, mineValue)) {
      applyChange(mine, source, change)
    }
  }

  private applyArrayChange<T>(change: DiffArray<T, any>, source: T, base: T, mine: T) {
    if (change.item.kind === Change.EDIT || change.item.kind === Change.DELETE) {
      this.applyEdit(change, [change.index], source, base, mine)
    } else if (change.item.kind === Change.NEW) {
      this.applyAdd(change, [change.index], source, base, mine)
    }
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
}
