import { buildSchema } from 'graphql'
import http from 'http'
import path from 'path'
import { stringify } from 'qs'
import { gte, satisfies } from 'semver'
import { Readable } from 'stream'

import { MetricsAccumulator } from '../../metrics/MetricsAccumulator'
import { parseBodyMiddleware } from '../../service/worker/runtime/events/middlewares/body'
import { extractQuery } from '../../service/worker/runtime/graphql/middlewares/query'
import { HttpClient } from '../HttpClient'
import { inflightUrlWithQuery } from './inflight'

// tslint:disable-next-line:no-var-requires
const qsVersion = require('qs/package.json').version as string

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

const requestFrom = (raw: string, contentType: string) => {
  const stream = new Readable({
    read() {
      this.push(raw)
      this.push(null)
    },
  }) as Readable & { headers: Record<string, string> }
  stream.headers = {
    'content-length': String(Buffer.byteLength(raw)),
    'content-type': contentType,
  }
  return stream
}

describe('qs floor and query serialization', () => {
  it('resolves qs at or above the CVE floor', () => {
    expect(gte(qsVersion, '6.15.2')).toBe(true)
  })

  it('keeps axios on the 0.30 line', () => {
    // tslint:disable-next-line:no-var-requires
    const axiosVersion = require('axios/package.json').version as string
    expect(satisfies(axiosVersion, '0.30.x')).toBe(true)
  })

  it('resolves the qs copy used by co-body at or above the CVE floor', () => {
    const coBodyDir = path.dirname(require.resolve('co-body/package.json'))
    // tslint:disable-next-line:no-var-requires
    const coBodyQs = require(require.resolve('qs/package.json', { paths: [coBodyDir] })).version as string
    expect(gte(coBodyQs, '6.15.2')).toBe(true)
  })

  it('stringifies arrays, nested objects, and empty params with arrayFormat repeat', () => {
    expect(stringify({ a: ['1', '2'] }, { arrayFormat: 'repeat' })).toBe('a=1&a=2')
    expect(stringify({ filter: { category: 'books' } }, { arrayFormat: 'repeat' })).toBe('filter%5Bcategory%5D=books')
    expect(stringify({}, { arrayFormat: 'repeat' })).toBe('')
    expect(
      stringify(
        { _from: 0, _to: 9, fq: ['C:/1/2/', 'P:[0 TO 100]'], ft: 'camiseta Masculina' },
        { arrayFormat: 'repeat' }
      )
    ).toBe('_from=0&_to=9&fq=C%3A%2F1%2F2%2F&fq=P%3A%5B0%20TO%20100%5D&ft=camiseta%20Masculina')
  })

  it('keeps inflightUrlWithQuery stable for the same params', () => {
    const params = { fq: ['C:/1/2/', 'P:[0 TO 100]'] }
    const first = inflightUrlWithQuery({
      baseURL: 'http://portal.vtexcommercestable.com.br',
      params,
      url: '/api/catalog_system/pub/products/search',
    })
    const second = inflightUrlWithQuery({
      baseURL: 'http://portal.vtexcommercestable.com.br',
      params: { fq: ['C:/1/2/', 'P:[0 TO 100]'] },
      url: '/api/catalog_system/pub/products/search',
    })

    expect(first).toBe(second)
    expect(first).toBe(
      'http://portal.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=C%3A%2F1%2F2%2F&fq=P%3A%5B0%20TO%20100%5D'
    )
  })
})

describe('HttpClient query string and single-flight', () => {
  let server: http.Server
  let baseURL: string
  let hits: number

  beforeAll(done => {
    hits = 0
    ;(global as any).metrics = new MetricsAccumulator()
    server = http.createServer((req, res) => {
      hits += 1
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ url: req.url }))
      }, 80)
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
    hits = 0
  })

  const client = () =>
    new HttpClient({
      baseURL,
      logger,
      memoizable: false,
      tracer,
    } as any)

  it('serializes array params with repeat format through HttpClient', async () => {
    const body = await client().get('/search', { params: { fq: ['a', 'b'] } })
    expect(body.url).toBe('/search?fq=a&fq=b')
  })

  it('coalesces concurrent identical params into one upstream call', async () => {
    const httpClient = client()
    const config = {
      inflightKey: inflightUrlWithQuery,
      params: { fq: ['a', 'b'] },
    }
    const [first, second] = await Promise.all([httpClient.get('/search', config), httpClient.get('/search', config)])

    expect(first.url).toBe('/search?fq=a&fq=b')
    expect(second.url).toBe(first.url)
    expect(hits).toBe(1)
  })
})

describe('event and GraphQL body parsing', () => {
  it('parses a JSON event body and calls next', async () => {
    const ctx: any = {
      req: requestFrom(JSON.stringify({ domain: 'oms', items: ['a', 'b'], orderId: '123' }), 'application/json'),
      state: {},
    }
    const next = jest.fn().mockResolvedValue(undefined)

    await parseBodyMiddleware(ctx, next)

    expect(ctx.state.body).toEqual({ domain: 'oms', items: ['a', 'b'], orderId: '123' })
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('returns 500 and skips the handler when JSON is malformed', async () => {
    const ctx: any = {
      req: requestFrom('{invalid-json', 'application/json'),
      state: {},
    }
    const next = jest.fn()

    await parseBodyMiddleware(ctx, next)

    expect(ctx.status).toBe(500)
    expect(String(ctx.body)).toContain('Error parsing event body')
    expect(next).not.toHaveBeenCalled()
  })

  it('parses form-urlencoded events with dotted keys and repeated arrays', async () => {
    const ctx: any = {
      req: requestFrom('order.id=123&sku=10&sku=20', 'application/x-www-form-urlencoded'),
      state: {},
    }
    const next = jest.fn().mockResolvedValue(undefined)

    await parseBodyMiddleware(ctx, next)

    expect(ctx.state.body).toEqual({ order: { id: '123' }, sku: ['10', '20'] })
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('parses a GraphQL POST JSON body via co-body json()', async () => {
    const schema = buildSchema('type Query { hello: String }')
    const middleware = extractQuery({ schema } as any)
    const ctx: any = {
      graphql: {},
      req: requestFrom(JSON.stringify({ query: '{ hello }' }), 'application/json'),
      request: {
        is: () => false,
        method: 'POST',
        url: '/graphql',
      },
    }

    await middleware(ctx, jest.fn().mockResolvedValue(undefined))

    expect(ctx.graphql.query.query).toBe('{ hello }')
    expect(ctx.graphql.query.document).toBeDefined()
  })
})
