import { pick } from 'ramda'
import { cleanError } from '../../../utils/error'

const ERROR_FIELD_WHITELIST = ['message', 'locations', 'path', 'stack', 'extensions', 'positions', 'statusCode', 'name', 'headers', 'source', 'code']

// formatError overrides the default option in runHttpQuery, which
// does not keep track of the error stack. All non-enumerable
// properties of Error (including stack) need to be returned
// explicitly, otherwise will not show up after a JSON.stringify call
export const formatError = (error: any) => {
  const formattedError = pick(ERROR_FIELD_WHITELIST, error)

  if (formattedError.extensions && formattedError.extensions.exception) {
    formattedError.extensions.exception = cleanError(formattedError.extensions.exception)
  }

  return formattedError
}
