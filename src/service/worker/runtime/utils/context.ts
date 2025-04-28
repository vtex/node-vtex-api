import { Context } from 'koa'
import uuid from 'uuid/v4'
import {
  HeaderKeys,
  REGION,
} from '../../../../constants'
import { UserLandTracer } from '../../../../tracing/UserLandTracer'
import { parseTenantHeaderValue } from '../../../../utils/tenant'
import { Logger } from '../../../logger'
import { IOContext, TracingContext } from '../typings'
import { parseBindingHeaderValue } from './../../../../utils/binding'

type HandlerContext = Omit<IOContext, 'route'>

const getPlatform = (account: string): string => {
  return account.startsWith('gc-') ? 'gocommerce' : 'vtex'
}

export const prepareHandlerCtx = (header: Context['request']['header'], tracingContext?: TracingContext): HandlerContext => {
  const partialContext = {
    account: header[HeaderKeys.ACCOUNT],
    authToken: header[HeaderKeys.CREDENTIAL],
    binding: header[HeaderKeys.BINDING] ? parseBindingHeaderValue(header[HeaderKeys.BINDING]) : undefined,
    host: header[HeaderKeys.FORWARDED_HOST],
    locale: header[HeaderKeys.LOCALE],
    operationId: header[HeaderKeys.OPERATION_ID] || uuid(),
    platform: header[HeaderKeys.PLATFORM] || getPlatform(header[HeaderKeys.ACCOUNT]),
    product: header[HeaderKeys.PRODUCT],
    production: header[HeaderKeys.WORKSPACE_IS_PRODUCTION]?.toLowerCase() === 'true' || false,
    region: REGION,
    requestId: header[HeaderKeys.REQUEST_ID],
    segmentToken: header[HeaderKeys.SEGMENT],
    sessionToken: header[HeaderKeys.SESSION],
    tenant: header[HeaderKeys.TENANT] ? parseTenantHeaderValue(header[HeaderKeys.TENANT]) : undefined,
    tracer: new UserLandTracer(tracingContext?.tracer!, tracingContext?.currentSpan),
    userAgent: process.env.VTEX_APP_ID || '',
    workspace: header[HeaderKeys.WORKSPACE],
  }

  return {
    ...partialContext,
    logger: new Logger(partialContext),
  }
}
