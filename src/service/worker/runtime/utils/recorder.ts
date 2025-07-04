import { Context } from 'koa'
import { trim } from 'ramda'
import { HeaderKeys } from './../../../../constants'

const HEADERS = [HeaderKeys.META, HeaderKeys.META_BUCKET]

export class Recorder {
  // tslint:disable-next-line: variable-name
  private _record: Record<string, Set<string>>

  constructor() {
    this._record = HEADERS.reduce(
      (acc, headerName) => {
        acc[headerName] = new Set<string>()
        return acc
      },
      {} as Record<string, Set<string>>
    )
  }

  public clear () {
    HEADERS.forEach(headerName => this._record[headerName].clear())
  }

  public record (headers?: Record<string, string>) {
    HEADERS.forEach(
      headerName => {
        const h = headers?.[headerName]
        if (h) {
          h.split(',').map(trim).forEach(hh => this._record[headerName].add(hh))
        }
      }
    )
  }

  public flush (ctx: Context) {
    HEADERS.forEach(
      headerName => {
        const newValueSet = new Set(this._record[headerName])
        const currentValue = ctx.response.get(headerName) as string | string[]
        const parsedCurrentValue = typeof currentValue === 'string' ? currentValue.split(',') : currentValue
        parsedCurrentValue.forEach(cur => newValueSet.add(trim(cur)))
        const deduped = Array.from(newValueSet).filter(x => !!x)
        if (deduped.length > 0) {
          ctx.set(headerName, deduped)
        }
      }
    )
  }
}
