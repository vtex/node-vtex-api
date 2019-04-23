import { AxiosError } from 'axios'

import { ResolverWarning } from './ResolverWarning'

/**
 * Indicates user input is not valid for this action.
 * ResolverWarnings are logged with level "warning" denoting they were handled by user code.
 *
 * @class UserInputError
 * @extends {ResolverWarning}
 */
export class UserInputError extends ResolverWarning {
  /**
   * Creates an instance of UserInputError
   * @param {(string | Error | AxiosError)} messageOrError Either a message string or the complete original error object.
   */
  constructor(messageOrError: string | Error | AxiosError) {
    super(messageOrError, 400, 'BAD_USER_INPUT')

    if (typeof messageOrError !== 'object') {
      Error.captureStackTrace(this, UserInputError)
    }
  }
}
