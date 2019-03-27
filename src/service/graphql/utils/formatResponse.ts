import { map } from 'ramda'

import { formatError } from './formatError'

export const formatResponse = (response: any) => {
  const {errors = null} = response || {}

  return {
    ...response,
    errors: Array.isArray(errors) ? map(formatError, errors) : undefined,
  }
}
