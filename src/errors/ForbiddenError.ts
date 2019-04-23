import { AxiosError } from 'axios'

import { ResolverWarning } from './ResolverWarning'

/**
 * Indicates user is not authorized to perform this action.
 * ResolverWarnings are logged with level "warning" denoting they were handled by user code.
 *
 * @class ForbiddenError
 * @extends {ResolverWarning}
 */
export class ForbiddenError extends ResolverWarning {
  /**
   * Creates an instance of ForbiddenError
   * @param {(string | Error | AxiosError)} messageOrError Either a message string or the complete original error object.
   */
  constructor(messageOrError: string | Error | AxiosError) {
    super(messageOrError, 403, 'FORBIDDEN')

    if (typeof messageOrError !== 'object') {
      Error.captureStackTrace(this, ForbiddenError)
    }
  }
}
