import { AxiosError } from 'axios'

import { ResolverWarning } from './ResolverWarning'

/**
 * Indicates a requested resource was not found.
 * ResolverWarnings are logged with level "warning" denoting they were handled by user code.
 *
 * @class NotFoundError
 * @extends {ResolverWarning}
 */
export class NotFoundError extends ResolverWarning {
  /**
   * Creates an instance of NotFoundError
   * @param {(string | Error | AxiosError)} messageOrError Either a message string or the complete original error object.
   */
  constructor(messageOrError: string | Error | AxiosError) {
    super(messageOrError, 404, 'NOT_FOUND')
  }
}
