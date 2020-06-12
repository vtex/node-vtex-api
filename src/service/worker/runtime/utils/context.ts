import { Context } from 'koa'
import uuid from 'uuid/v4'

import {
  ACCOUNT_HEADER,
  BINDING_HEADER,
  CREDENTIAL_HEADER,
  FORWARDED_HOST_HEADER,
  LOCALE_HEADER,
  OPERATION_ID_HEADER,
  PLATFORM_HEADER,
  PRODUCT_HEADER,
  REGION,
  REQUEST_ID_HEADER,
  SEGMENT_HEADER,
  SESSION_HEADER,
  TENANT_HEADER,
  WORKSPACE_HEADER,
  WORKSPACE_IS_PRODUCTION_HEADER,
} from '../../../../constants'
import { UserLandTracer } from '../../../../tracing/UserLandTracer'
import { parseTenantHeaderValue } from '../../../../utils/tenant'
import { Logger } from '../../../logger'
import { IOContext, RuntimeTracingContext } from '../typings'
import { parseBindingHeaderValue } from './../../../../utils/binding'

type HandlerContext = Omit<IOContext, 'route'>

const getPlatform = (account: string): string => {
  return account.startsWith('gc-') ? 'gocommerce' : 'vtex'
}

export const prepareHandlerCtx = (header: Context['request']['header'], tracingContext: RuntimeTracingContext): HandlerContext => {
  const partialContext = {
    account: header[ACCOUNT_HEADER],
    authToken: header[CREDENTIAL_HEADER],
    binding: header[BINDING_HEADER] ? parseBindingHeaderValue(header[BINDING_HEADER]) : undefined,
    host: header[FORWARDED_HOST_HEADER],
    locale: header[LOCALE_HEADER],
    operationId: header[OPERATION_ID_HEADER] || uuid(),
    platform: header[PLATFORM_HEADER] || getPlatform(header[ACCOUNT_HEADER]),
    product: header[PRODUCT_HEADER],
    production: header[WORKSPACE_IS_PRODUCTION_HEADER]?.toLowerCase() === 'true' || false,
    region: REGION,
    requestId: header[REQUEST_ID_HEADER],
    segmentToken: header[SEGMENT_HEADER],
    sessionToken: header[SESSION_HEADER],
    tenant: header[TENANT_HEADER] ? parseTenantHeaderValue(header[TENANT_HEADER]) : undefined,
    tracer: new UserLandTracer(tracingContext.tracer, tracingContext.currentSpan),
    userAgent: process.env.VTEX_APP_ID || '',
    workspace: header[WORKSPACE_HEADER],
  }

  return {
    ...partialContext,
    logger: new Logger(partialContext),
  }
}
