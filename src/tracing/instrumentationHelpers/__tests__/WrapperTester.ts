import { MockReport, MockSpan, MockUserlandTracer } from '@vtex/node-tracing-mocks'
import { SpanReferenceTypes } from '../../..'
import { Logger } from '../../../service/logger'
import { CallerTracingConfig, TracingInstrumentationOptions } from '../wrappers'

export interface WrapperTesterConfig {
  handlerType: 'async' | 'sync'
  useFallbackSpan?: boolean
  instrumentedHandlerCreator: (
    opts: TracingInstrumentationOptions
  ) => (callerTracingConfig: CallerTracingConfig, ...args: any[]) => Promise<any> | any
  args: any[]
}

type WrapperTesterOpts = {
  instrumentationOptions?: Omit<TracingInstrumentationOptions, 'operationName'> & { operationName?: string }
  spanReferenceType?: SpanReferenceTypes
}

export function createMockLogger() {
  return new Logger({
    account: 'mock-account',
    operationId: 'mock-operation-id',
    production: false,
    requestId: 'mock-request-id',
    workspace: 'mock-workspace',
  })
}

export class WrapperTester {
  public static async runInstrumentedHandler(config: WrapperTesterConfig, opts?: WrapperTesterOpts) {
    const tester = new WrapperTester(config)
    await tester.runInstrumentedHandler(opts)
    return tester
  }

  public tracer: MockUserlandTracer
  public logger: Logger
  public rootSpan: MockSpan
  public tracerReport?: MockReport
  public createdSpan?: MockSpan

  // tslint:disable-next-line
  private _res?: any
  // tslint:disable-next-line
  private _error?: any

  constructor(private config: WrapperTesterConfig) {
    this.tracer = new MockUserlandTracer()
    this.logger = new Logger({
      account: 'mock-account',
      operationId: 'mock-operation-id',
      production: false,
      requestId: 'mock-request-id',
      workspace: 'mock-workspace',
    })
    if (config.useFallbackSpan) {
      this.rootSpan = this.tracer.fallbackSpan
    } else {
      this.rootSpan = this.tracer.startSpan('provided-parent-span') as MockSpan
    }
  }

  get error() {
    if (!this._error) {
      throw new Error('No error on handler execution')
    }
    return this._error
  }

  get ret() {
    if (this._error) {
      throw this._error
    }
    return this._res
  }

  public async runInstrumentedHandler(opts?: WrapperTesterOpts & { tracingCtx?: CallerTracingConfig }) {
    const instrumentedHandler = this.config.instrumentedHandlerCreator({
      operationName: 'instrumented-handler-span',
      ...opts?.instrumentationOptions,
    })

    const tracingCtx = opts?.tracingCtx ?? {
      tracer: this.tracer,
      logger: this.logger,
      ...(this.rootSpan ? { currentSpan: this.rootSpan } : null),
      ...(opts?.spanReferenceType ? { spanReferenceType: opts?.spanReferenceType } : null),
    }

    try {
      this._res = instrumentedHandler(tracingCtx, ...this.config.args)

      if (this.config.handlerType === 'async') {
        expect(this._res).toBeInstanceOf(Promise)
        this._res = await this._res
      } else {
        expect(this._res).not.toBeInstanceOf(Promise)
      }
    } catch (err) {
      this._error = err
    }

    this.rootSpan.finish()
    this.tracerReport = this.tracer.mockTracer.report()
    this.createdSpan = this.tracerReport?.spans[this.tracerReport.spans.length - 1]
  }
}
