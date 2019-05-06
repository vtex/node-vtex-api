import { AxiosError } from 'axios'

import { ErrorLike } from './ResolverError'
import { ResolverWarning } from './ResolverWarning'

/**
 * Indicates user is not authorized to perform this action.
 * ResolverWarnings are logged with level "warning" denoting they were handled by user code.
 *
 * @class ForbiddenError
 * @extends {ResolverWarning}
 */
export class ForbiddenError extends ResolverWarning {
  public name = 'ForbiddenError'

  /**
   * Creates an instance of ForbiddenError
   * @param {(string | AxiosError | ErrorLike)} messageOrError Either a message string or the complete original error object.
   */
  constructor(messageOrError: string | AxiosError | ErrorLike) {
    super(messageOrError, 403, 'FORBIDDEN')

    if (typeof messageOrError === 'string' || !messageOrError.stack) {
      Error.captureStackTrace(this, ForbiddenError)
    }
  }
}
