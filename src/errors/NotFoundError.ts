import { AxiosError } from 'axios'

import { ErrorLike } from './ResolverError'
import { ResolverWarning } from './ResolverWarning'

/**
 * Indicates a requested resource was not found.
 * ResolverWarnings are logged with level "warning" denoting they were handled by user code.
 *
 * @class NotFoundError
 * @extends {ResolverWarning}
 */
export class NotFoundError extends ResolverWarning {
  public name = 'NotFoundError'

  /**
   * Creates an instance of NotFoundError
   * @param {(string | AxiosError | ErrorLike)} messageOrError Either a message string or the complete original error object.
   */
  public constructor(messageOrError: string | AxiosError | ErrorLike) {
    super(messageOrError, 404, 'NOT_FOUND')

    if (typeof messageOrError === 'string' || !messageOrError.stack) {
      Error.captureStackTrace(this, NotFoundError)
    }
  }
}
