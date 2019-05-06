import { AxiosError } from 'axios'

import { ErrorLike } from './ResolverError'
import { ResolverWarning } from './ResolverWarning'

/**
 * Indicates user did not provide valid credentials for authenticating this request.
 * ResolverWarnings are logged with level "warning" denoting they were handled by user code.
 *
 * @class AuthenticationError
 * @extends {ResolverWarning}
 */
export class AuthenticationError extends ResolverWarning {
  public name = 'AuthenticationError'

  /**
   * Creates an instance of AuthenticationError
   * @param {(string | AxiosError | ErrorLike)} messageOrError Either a message string or the complete original error object.
   */
  constructor(messageOrError: string | AxiosError | ErrorLike) {
    super(messageOrError, 401, 'UNAUTHENTICATED')

    if (typeof messageOrError === 'string' || !messageOrError.stack) {
      Error.captureStackTrace(this, AuthenticationError)
    }
  }
}
