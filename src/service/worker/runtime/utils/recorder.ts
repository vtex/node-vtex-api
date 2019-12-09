import { Context } from 'koa'
import { trim, uniqWith } from 'ramda'

// uniqWith is way faster than ramda's uniq
const uniqStr = uniqWith((a: string, b: string) => a === b)

const appendResponseHeader = (ctx: Context, responseHeaders: any, targetHeader: string) => {
  const headerValue = responseHeaders[targetHeader]
  if (headerValue) {
    const currentValue = ctx.response.get(targetHeader) || []
    const newValue = headerValue.split(',').map(trim)
    ctx.set(targetHeader, uniqStr([...currentValue, ...newValue]))
  }
}

export const createRecorder = (ctx: Context) => (headers: any) => {
  appendResponseHeader(ctx, headers, 'x-vtex-meta')
  appendResponseHeader(ctx, headers, 'x-vtex-meta-bucket')
}
