export const cancelledRequestStatus = 499

export const cancelledErrorCode = 'request_cancelled'

export class RequestCancelledError extends Error {
  public code = cancelledErrorCode

  constructor(message: string) {
    super(message)
  }
}
