import { AxiosError } from 'axios'

import { ResolverWarning } from './ResolverWarning'

/**
 * Indicates user did not provide valid credentials for authenticating this request.
 * ResolverWarnings are logged with level "warning" denoting they were handled by user code.
 *
 * @class AuthenticationError
 * @extends {ResolverWarning}
 */
export class AuthenticationError extends ResolverWarning {
  /**
   * Creates an instance of AuthenticationError
   * @param {(string | Error | AxiosError)} messageOrError Either a message string or the complete original error object.
   */
  constructor(messageOrError: string | Error | AxiosError) {
    super(messageOrError, 401, 'UNAUTHENTICATED')
  }
}
