import { AxiosError } from 'axios'

import { ResolverError } from './ResolverError'

/**
 * Indicates a non-fatal error occurred and was handled.
 * ResolverWarnings are logged with level "warning" denoting they were handled by user code.
 *
 * @class ResolverWarning
 * @extends {ResolverError}
 */
export class ResolverWarning extends ResolverError {
  /**
   * Creates an instance of ResolverWarning
   * @param {(string | Error | AxiosError)} messageOrError Either a message string or the complete original error object.
   */
  constructor(
    messageOrError: string | Error | AxiosError,
    public status: number = 422,
    public code: string = 'RESOLVER_WARNING'
  ) {
    super(messageOrError, status, code)
  }
}
