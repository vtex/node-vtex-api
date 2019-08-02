import { AxiosError } from 'axios'

import { LogLevel } from '../clients/Logger'
import { cleanError } from '../utils/error'

export interface ErrorLike {
  name?: string
  message: string
  stack?: string
  [key: string]: any
}

/**
 * The generic Error class to be thrown for caught errors inside resolvers.
 * Errors with status code greater than or equal to 500 are logged as errors.
 * All other status codes are logged as warnings. @see ResolverWarning
 *
 * @class ResolverError
 * @extends {Error}
 */
export class ResolverError extends Error {
  public name = 'ResolverError'
  public level = LogLevel.Error

  /**
   * Creates an instance of ResolverError
   * @param {(string | AxiosError | ErrorLike)} messageOrError Either a message string or the complete original error object.
   * @param {number} [status=500]
   * @param {string} [code='RESOLVER_ERROR']
   */
  public constructor(
    messageOrError: string | AxiosError | ErrorLike,
    public status: number = 500,
    public code: string = 'RESOLVER_ERROR'
  ) {
    super(
      typeof messageOrError === 'string'
        ? messageOrError
        : messageOrError.message
    )

    if (typeof messageOrError === 'object') {
      // Copy original error properties without circular references
      Object.assign(this, cleanError(messageOrError))
    }

    if (typeof messageOrError === 'string' || !messageOrError.stack) {
      Error.captureStackTrace(this, ResolverError)
    }
  }
}
