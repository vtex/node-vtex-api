/**
 * @jest-environment node
 */
import { createServer, Server } from 'http'
import * as jaegerClient from 'jaeger-client'
import { AddressInfo } from 'net'

import { HttpClient } from '../../HttpClient'
import { UserLandTracer } from '../UserLandTracer'

const listen = (server: Server) =>
  new Promise<string>(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)))
const close = (server: Server) => new Promise<void>(resolve => server.close(() => resolve()))
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// A logger that stores its logs with a request, as some apps do after replacing `ctx.vtex.logger`.
// The store refuses every write, so each log it tries to save is itself a failed request.
const MAX_LOGS = 25

type Entry = Record<string, any>

describe('error reports written to a logger that makes requests', () => {
  let upstream: Server
  let baseURL: string
  let received: number
  let reported: Array<Entry>
  let refusedWrites: Array<Entry>

  // Every trace is sampled, and the spans stay in memory. The typings of jaeger-client leave the
  // in-memory reporter and `close` out.
  const jaeger = jaegerClient.initTracer(
    { serviceName: 'reporting-scope-test', sampler: { type: 'const', param: 1 } },
    { reporter: new (jaegerClient as any).InMemoryReporter() }
  )

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      received++
      req.resume()
      req.on('end', () => {
        res.statusCode = 403
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ code: 'Forbidden', message: 'cannot perform action POST' }))
      })
    })
    baseURL = await listen(upstream)
  })

  afterAll(async () => {
    await close(upstream)
    ;(jaeger as any).close()
  })

  beforeEach(() => {
    received = 0
    reported = []
    refusedWrites = []
  })

  // Waits until the upstream stops receiving requests.
  const settle = async () => {
    let seen = -1
    while (seen !== received) {
      seen = received
      await sleep(100)
    }
  }

  // An HttpClient on a sampled trace, as the runtime builds it for one request of an app.
  const clientOnSampledTrace = (makeLogger: (client: () => HttpClient) => { error: (log: any) => void }) => {
    const span = jaeger.startSpan('incoming-request')
    const tracer = new UserLandTracer(jaeger, span)
    tracer.lockFallbackSpan()
    const context: any = {
      account: 'acme',
      authToken: 'fake-token',
      operationId: 'operation-id',
      production: true,
      region: 'aws-us-east-1',
      requestId: 'request-id',
      tracer,
      userAgent: 'acme.app@0.0.0',
      workspace: 'master',
    }
    let client: HttpClient
    context.logger = makeLogger(() => client)
    client = new HttpClient({ ...context, baseURL, retries: 0, timeout: 5000 })
    return client
  }

  const storingLogger = (client: () => HttpClient) => ({
    error: (log: any) => {
      reported.push(log)
      if (reported.length >= MAX_LOGS) {
        return
      }
      // Not awaited by the app; caught here only so the test sees the rejection.
      client().post('/logs', { message: JSON.stringify(log) }).catch(err => refusedWrites.push(err))
    },
  })

  it('does not report the failure of a request the logger made to store a report', async () => {
    const client = clientOnSampledTrace(storingLogger)

    await expect(client.post('/documents', { name: 'value' })).rejects.toThrow('Request failed with status code 403')
    await settle()

    // The failed request of the app, and the one request the logger made to store its report.
    expect(received).toBe(2)
    expect(reported).toHaveLength(1)
    expect(reported[0].message).toBe('Request failed with status code 403')
    // The request of the logger still rejects to the logger.
    expect(refusedWrites).toHaveLength(1)
    expect(refusedWrites[0].response.status).toBe(403)
  })

  it('reports again the next failure that the logger did not start', async () => {
    const client = clientOnSampledTrace(storingLogger)

    await expect(client.post('/documents', { name: 'first' })).rejects.toThrow()
    await settle()
    await expect(client.post('/documents', { name: 'second' })).rejects.toThrow()
    await settle()

    expect(reported).toHaveLength(2)
    expect(received).toBe(4)
  })

  it('reports every failure when the logger makes no requests', async () => {
    const client = clientOnSampledTrace(() => ({ error: (log: any) => reported.push(log) }))

    await expect(client.post('/documents', { name: 'first' })).rejects.toThrow()
    await expect(client.get('/documents/1')).rejects.toThrow()

    expect(reported).toHaveLength(2)
    expect(received).toBe(2)
  })
})
