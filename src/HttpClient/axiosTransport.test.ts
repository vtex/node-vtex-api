import axios from 'axios'
import { readFileSync } from 'fs'
import http from 'http'
import path from 'path'
import { gte } from 'semver'

import { MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { HttpClient } from './HttpClient'
import { HttpAgentSingleton } from './middlewares/request/HttpAgentSingleton'

// tslint:disable-next-line:no-var-requires
const axiosVersion = require('axios/package.json').version as string
const publishedPackage = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'))

const tracer = {
  fallbackSpanContext: () => ({}),
  isTraceSampled: false,
  startSpan: () => ({}),
}

const logger = {
  debug: () => undefined,
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
}

describe('axios floor', () => {
  it('publishes axios at ^1.16.1 and resolves that floor', () => {
    expect(publishedPackage.dependencies.axios).toBe('^1.16.1')
    expect(gte(axiosVersion, '1.16.1')).toBe(true)
  })
})

describe('HttpClient transport', () => {
  let server: http.Server
  let baseURL: string
  let flakyHits: number

  beforeAll(done => {
    ;(global as any).metrics = new MetricsAccumulator()
    server = http.createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/ok' })
        res.end()
        return
      }
      if (req.url === '/fail') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: true }))
        return
      }
      if (req.url === '/flaky') {
        flakyHits += 1
        if (flakyHits < 3) {
          res.writeHead(504, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code: 'timeout' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ attempts: flakyHits, ok: true }))
        return
      }
      if (req.url === '/slow') {
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ slow: true }))
        }, 350)
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ url: req.url }))
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number }
      baseURL = `http://127.0.0.1:${address.port}`
      done()
    })
  })

  afterAll(done => {
    delete (global as any).metrics
    server.close(done)
  })

  beforeEach(() => {
    flakyHits = 0
  })

  const client = (timeout = 1000) =>
    new HttpClient({
      baseURL,
      logger,
      memoizable: false,
      timeout,
      tracer,
    } as any)

  it('resolves 2xx and rejects non-2xx without following redirects', async () => {
    await expect(client().get('/ok')).resolves.toEqual({ url: '/ok' })
    await expect(client().get('/fail')).rejects.toMatchObject({ response: { status: 400 } })
    await expect(client().get('/redirect')).rejects.toMatchObject({ response: { status: 302 } })
  })

  it('keeps the SDK array serializer instead of the axios default', async () => {
    const body = await client().get('/search', { params: { fq: ['a', 'b'] } })
    expect(body.url).toBe('/search?fq=a&fq=b')
  })

  it('times out when response headers exceed the timeout and stays open when timeout is 0', async () => {
    await expect(client().get('/slow', { retries: 0, timeout: 120 })).rejects.toMatchObject({ code: 'ECONNABORTED' })
    await expect(client().get('/slow', { retries: 0, timeout: 0 })).resolves.toEqual({ slow: true })
  })

  it('retries a 504 on the shared HTTP agent', async () => {
    const agent = HttpAgentSingleton.getHttpAgent()
    const addRequest = jest.spyOn(agent as any, 'addRequest')
    const body = await client().get('/flaky', { initialBackoffDelay: 10, retries: 2 })

    expect(body).toEqual({ attempts: 3, ok: true })
    expect(flakyHits).toBe(3)
    const agents = addRequest.mock.instances
    expect(agents.length).toBeGreaterThanOrEqual(3)
    expect(new Set(agents).size).toBe(1)
    expect(agents[0]).toBe(agent)
    addRequest.mockRestore()
  })

  it('aborts an in-flight request with CancelToken', async () => {
    const source = axios.CancelToken.source()
    setTimeout(() => source.cancel('user-cancelled'), 30)
    await expect(client().get('/slow', { cancelToken: source.token, retries: 0, timeout: 1000 })).rejects.toThrow(
      'user-cancelled'
    )
  })
})
