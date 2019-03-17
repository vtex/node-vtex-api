import {pick} from 'ramda'

export const PICKED_AXIOS_PROPS = ['baseURL', 'cacheable', 'data', 'finished', 'headers', 'method', 'timeout', 'status', 'path', 'url']

export const cleanError = (err: any) => {
  if (!err) {
    return {}
  }

  const {code, name, message, stack, config, request, response, captured, queryErrors} = err

  return {
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
