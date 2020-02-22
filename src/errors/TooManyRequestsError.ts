export const tooManyRequestsStatus = 429

export class TooManyRequestsError extends Error {
  constructor(message?: string) {
    super(message ?? 'TOO_MANY_REQUESTS')
  }
}
