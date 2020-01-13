import { Context } from 'koa'
import { trim, uniqWith } from 'ramda'

import { META_HEADER, META_HEADER_BUCKET } from './../../../../constants'
import { toArray } from './toArray'

export type SlowRecorder = (headers: Record<string, string>) => void

// uniqWith is way faster than ramda's uniq
const uniqStr = uniqWith((a: string, b: string) => a === b)

const appendResponseHeader = (ctx: Context, responseHeaders: any, targetHeader: string) => {
  const headerValue = responseHeaders[targetHeader]
  if (headerValue) {
    const currentValue = toArray(ctx.response.get(targetHeader) || [])
    const newValue = headerValue.split(',').map(trim)
    const deduped = uniqStr([...currentValue, ...newValue])
    ctx.set(targetHeader, deduped.join(','))
  }
}

export const createSlowRecorder = (ctx: Context): SlowRecorder => (headers: Record<string, string>) => {
  appendResponseHeader(ctx, headers, META_HEADER)
  appendResponseHeader(ctx, headers, META_HEADER_BUCKET)
}

export const isSlowRecorder = (x: any): x is SlowRecorder => typeof x === 'function' && !x._record

const HEADERS = [META_HEADER, META_HEADER_BUCKET]

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

  public clear = () => HEADERS.forEach(headerName => this._record[headerName].clear())

  public record = (headers?: Record<string, string>) => HEADERS.forEach(
    headerName => {
      const h = headers?.[headerName]
      if (h) {
        h.split(',').map(trim).forEach(hh => this._record[headerName].add(hh))
      }
    }
  )

  public flush = (ctx: Context) => HEADERS.forEach(
    headerName => {
      const currentValue = ctx.response.get(headerName) as string | string[]
      const parsedCurrentValue = typeof currentValue === 'string'
        ? currentValue.split(',')
        : currentValue
      const toAppend = Array.from(this._record[headerName])
      const deduped = uniqStr([...parsedCurrentValue, ...toAppend].filter(x => !!x))
      if (deduped.length > 0) {
        ctx.set(headerName, deduped)
      }
    }
  )
}
