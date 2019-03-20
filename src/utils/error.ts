import stringify from 'json-stringify-safe'
import {pick} from 'ramda'

export const PICKED_AXIOS_PROPS = ['baseURL', 'cacheable', 'data', 'finished', 'headers', 'method', 'timeout', 'status', 'path', 'url']

const errorReplacer = (key: string, value: any) => {
  if (key.startsWith('_')) {
    return undefined
  }
  if (value && typeof value === 'string' && value.length > 1024) {
    return value.substr(0, 256) + '[...TRUNCATED]'
  }
  return value
}

export const cleanError = (err: any) => {
  if (!err) {
    return {}
  }

  const {code: errorCode, name, message, stack, config, request, response, captured, queryErrors, ...rest} = err
  const code = errorCode || response && response.status && `E_HTTP_${response.status}` || 'E_UNKNOWN'

  return {
    ... rest ? JSON.parse(stringify(rest, errorReplacer)) : null,
    captured,
    code,
    message,
    name,
    queryErrors,
    stack,
    ... config ? {config: pick(PICKED_AXIOS_PROPS, config)} : undefined,
    ... request ? {request: pick(PICKED_AXIOS_PROPS, request)} : undefined,
    ... response ? {response: pick(PICKED_AXIOS_PROPS, response)} : undefined,
  }
}
