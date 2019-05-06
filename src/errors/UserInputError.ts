import { AxiosError } from 'axios'

import { ErrorLike } from './ResolverError'
import { ResolverWarning } from './ResolverWarning'

/**
 * Indicates user input is not valid for this action.
 * ResolverWarnings are logged with level "warning" denoting they were handled by user code.
 *
 * @class UserInputError
 * @extends {ResolverWarning}
 */
export class UserInputError extends ResolverWarning {
  public name = 'UserInputError'

  /**
   * Creates an instance of UserInputError
   * @param {(string | AxiosError | ErrorLike)} messageOrError Either a message string or the complete original error object.
   */
  constructor(messageOrError: string | AxiosError | ErrorLike) {
    super(messageOrError, 400, 'BAD_USER_INPUT')

    if (typeof messageOrError === 'string' || !messageOrError.stack) {
      Error.captureStackTrace(this, UserInputError)
    }
  }
}
