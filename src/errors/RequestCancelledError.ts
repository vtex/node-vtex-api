export const cancelledRequestStatus = 499

export class RequestCancelledError extends Error {
  public code = 'request_cancelled'

  constructor(message: string) {
    super(message)
  }
}
