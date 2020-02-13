import { ExternalClient } from './ExternalClient'
import { IOContext, InstanceOptions, Maybe } from '../..'

const routes = {
  callback: (transactionId: string, paymentId: string) =>
    `${routes.payment(transactionId, paymentId)}/notification`,
  inbound: (transactionId: string, paymentId: string, action: string) =>
    `${routes.payment(transactionId, paymentId)}/inbound-request/${action}`,
  payment: (transactionId: string, paymentId: string) =>
    `/transactions/${transactionId}/payments/${paymentId}`,
}

export class PaymentProvider extends ExternalClient {
  constructor(protected context: IOContext, options?: InstanceOptions) {
    super(
      `http://${context.account}.vtexpayments.com.br/payment-provider`,
      context,
      {
        ...(options ?? {}),
        headers: {
          ...(options?.headers ?? {}),
          'X-Vtex-Use-Https': 'true',
        },
      }
    )
  }

  public callback = (
    transactionId: string,
    paymentId: string,
    callback: AuthorizationCallback
  ) =>
    this.http.post<unknown>(
      routes.callback(transactionId, paymentId),
      callback,
      {
        metric: 'gateway-callback',
      }
    )

  public inbound = <TRequest, TResponse>(
    transactionId: string,
    paymentId: string,
    action: string,
    payload: TRequest
  ) =>
    this.http.post<TResponse>(
      routes.inbound(transactionId, paymentId, action),
      payload,
      {
        metric: 'gateway-inbound-request',
      }
    )
}

export interface AuthorizationCallback {
  paymentId: string
  status: string
  tid: string
  authorizationId?: Maybe<string>
  nsu?: Maybe<string>
  acquirer: string
  paymentUrl?: Maybe<string>
  paymentAppData?: Maybe<{
    appName: string
    payload: string
  }>
  identificationNumber?: Maybe<string>
  identificationNumberFormatted?: Maybe<string>
  barCodeImageType?: Maybe<string>
  barCodeImageNumber?: Maybe<string>
  code?: Maybe<string>
  message?: Maybe<string>
  delayToAutoSettle?: Maybe<number>
  delayToAutoSettleAfterAntifraud?: Maybe<number>
  delayToCancel?: Maybe<number>
}
