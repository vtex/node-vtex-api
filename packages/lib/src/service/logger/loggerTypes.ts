import { IOContext } from '../worker/runtime/typings'

export interface LoggerContext extends Pick<IOContext, 'account'|'workspace'|'requestId'|'operationId'|'production'> {
  tracer?: IOContext['tracer']
}

export interface TracingState {
  isTraceSampled: boolean,
  traceId?: string
}

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}
