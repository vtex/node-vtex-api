import { Context } from 'koa'
import { trim, uniqWith } from 'ramda'

import { toArray } from './toArray'

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

export const createRecorder = (ctx: Context) => (headers: any) => {
  appendResponseHeader(ctx, headers, 'x-vtex-meta')
  appendResponseHeader(ctx, headers, 'x-vtex-meta-bucket')
}
