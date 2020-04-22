import { MockReport, MockSpan } from '@tiagonapoli/opentracing-alternate-mock'
import { AxiosInstance, AxiosResponse } from 'axios'
import { Span } from 'opentracing'
import { RequestTracingConfig, TraceableRequestConfig } from '../../../../typings'
import { TestTracer } from './TestTracer'

interface TracedTestRequestConfig extends RequestTracingConfig {
  url: string
  params?: any
  retries?: number
  timeout?: number
  baseURL?: string
}

export class TracedTestRequest {
  public static async doRequest(http: AxiosInstance, reqConfig: TracedTestRequestConfig) {
    const request = new TracedTestRequest(http)
    await request.runRequest(reqConfig)
    return request
  }

  public tracer: TestTracer
  public rootSpan: MockSpan
  public tracerReport?: MockReport
  public lastRequestSpan?: MockSpan

  // tslint:disable-next-line
  private _res?: AxiosResponse
  // tslint:disable-next-line
  private _error?: any

  constructor(private http: AxiosInstance) {
    this.tracer = new TestTracer()
    this.rootSpan = this.tracer.startSpan('root-span') as MockSpan
  }

  get error() {
    if (!this._error) {
      throw new Error('No error on request')
    }
    return this._error
  }

  get res() {
    if (!this._res) {
      throw new Error('No response on request')
    }
    return this._res
  }

  get allRequestSpans() {
    const spans = this.tracerReport?.spans.filter((span) => span.operationName().startsWith('http-request'))
    if (!spans?.length) {
      throw new Error('No request spans')
    }

    return spans
  }

  public async runRequest(reqConf: TracedTestRequestConfig) {
    try {
      const axiosReqConf: TraceableRequestConfig = {
        ...reqConf,
        tracing: {
          ...reqConf.tracing,
          rootSpan: (this.rootSpan as unknown) as Span,
          tracer: this.tracer,
        },
      }

      this._res = await this.http.get(reqConf.url, axiosReqConf)
    } catch (err) {
      this._error = err
    } finally {
      this.rootSpan.finish()
      this.tracerReport = this.tracer.mockTracer.report()

      this.lastRequestSpan = this.tracerReport.spans
        .slice()
        .reverse()
        .find((span) => span.operationName().startsWith('http-request'))
    }
  }
}
