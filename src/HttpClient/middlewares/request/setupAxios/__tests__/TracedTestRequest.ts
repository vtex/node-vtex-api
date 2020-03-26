import { AxiosInstance, AxiosResponse } from 'axios'
import { MockSpan } from 'opentracing/lib/mock_tracer'
import MockReport from 'opentracing/lib/mock_tracer/mock_report'
import { CustomMockTracer } from './CustomMockTracer'

export class TracedTestRequest {
  public static async doRequest(http: AxiosInstance, { url, params, retries, timeout, baseURL }: any) {
    const request = new TracedTestRequest(http)
    await request.runRequest({ url, retries, timeout, params, baseURL })
    return request
  }

  public tracer: CustomMockTracer
  public rootSpan: MockSpan
  public tracerReport?: MockReport
  public requestSpan?: MockSpan
  public url?: string
  // tslint:disable-next-line
  private _res?: AxiosResponse
  // tslint:disable-next-line
  private _error?: any

  constructor(private http: AxiosInstance) {
    this.tracer = new CustomMockTracer()
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
    return this.tracerReport?.spans.filter(span => span.operationName() === 'http-request')
  }

  public async runRequest({ url, retries, timeout, params, baseURL }: any) {
    try {
      this.url = url
      this._res = await this.http.get(url, {
        // @ts-ignore
        tracing: { rootSpan: this.rootSpan, tracer: this.tracer },
        ...(baseURL ? { baseURL } : null),
        ...(params ? { params } : null),
        ...(retries ? { retries } : null),
        ...(timeout ? { timeout } : null),
      })
    } catch (err) {
      this._error = err
    } finally {
      this.rootSpan.finish()
      this.tracerReport = this.tracer.report()
      this.requestSpan = this.tracerReport.spans.find(span => span.operationName() === 'http-request')
    }
  }
}
