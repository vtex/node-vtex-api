/**
 * @jest-environment node
 */
import axios, { AxiosError } from 'axios'
import { buildSchema, graphql } from 'graphql'
import { Agent, createServer, Server } from 'http'
import Koa from 'koa'
import compress from 'koa-compress'
import { gunzipSync } from 'zlib'

const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'

// Axios 0.30 errors are circular through the agent, so JSON.stringify throws. Skipping a repeated
// object keeps the credential headers, which is the leak a careful stringify still produces.
const stringifyCircular = (value: any) => {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, (property, current) => {
    if (typeof property === 'string' && typeof current === 'object' && current !== null) {
      if (seen.has(current)) {
        return undefined
      }
      seen.add(current)
    }
    return current
  })
}
const RESPONSE_SANITIZER_SWITCH = 'VTEX_IO_RESPONSE_SANITIZER'
const REDACTED = '[Redacted]'

// The middleware reads whether the app is linked when it is loaded, so each use gets a fresh copy.
const loadSanitizeResponse = () => {
  let loaded: any
  jest.resetModules()
  jest.isolateModules(() => {
    loaded = require('./sanitizeResponse').sanitizeResponse
  })
  return loaded as typeof import('./sanitizeResponse').sanitizeResponse
}

type Handler = (ctx: any) => Promise<void> | void
const listen = (server: Server) =>
  new Promise<string>(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as any).port}`)))

const close = (server: Server) => new Promise<void>(resolve => server.close(() => resolve()))

describe('sanitizeResponse', () => {
  const agent = new Agent({ keepAlive: false })
  let upstream: Server
  let upstreamURL: string
  let handler: Handler
  let appServer: Server
  let appURL: string
  let captured: { body?: any, status?: number, thrown?: any }
  let rawLogs: string[]
  const logs = () => rawLogs.map(log => JSON.parse(log))

  const callUpstream = async (): Promise<AxiosError> => {
    try {
      await axios.get(`${upstreamURL}/orders`, {
        headers: { 'Proxy-Authorization': TOKEN },
        httpAgent: agent,
      })
    } catch (e) {
      return e as AxiosError
    }
    throw new Error('the upstream call was expected to fail')
  }

  const buildApp = (withSanitizer: boolean, middleware?: (ctx: any, next: () => Promise<void>) => Promise<void>) => {
    const app = new Koa()
    app.use(async (ctx, next) => {
      // Stands for the `error` middleware, the outermost one, and for the context of the service.
      ctx.vtex = { logger: { warn: (log: any) => rawLogs.push(JSON.stringify(log)) }, route: { id: 'orders' } }
      try {
        await next()
      } catch (e) {
        captured.thrown = e
        ctx.status = 500
      }
      captured.status = ctx.status
    })
    app.use(compress())
    app.use(async (ctx, next) => {
      // Sees the body as the sanitizer leaves it, before compress() serializes it.
      try {
        await next()
      } finally {
        captured.body = ctx.body
      }
    })
    if (withSanitizer) {
      app.use((middleware ?? loadSanitizeResponse()) as any)
    }
    app.use(async ctx => { await handler(ctx) })
    return app
  }

  const startApp = async (withSanitizer = true, middleware?: (ctx: any, next: () => Promise<void>) => Promise<void>) => {
    appServer = createServer(buildApp(withSanitizer, middleware).callback())
    appURL = await listen(appServer)
  }

  // Decompresses by hand: axios would do it and hide whether the response was compressed.
  const get = (path = '/', headers: Record<string, string> = {}) =>
    axios.get(`${appURL}${path}`, {
      decompress: false,
      headers: { 'Accept-Encoding': 'gzip', ...headers },
      httpAgent: agent,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    }).then(res => {
      const encoding: string | undefined = res.headers['content-encoding']
      const raw = Buffer.from(res.data)
      const text = (encoding === 'gzip' ? gunzipSync(raw) : raw).toString('utf8')
      return { encoding, headers: res.headers, status: res.status, text }
    })

  beforeAll(async () => {
    upstream = createServer((_, res) => {
      res.setHeader('content-type', 'application/json')
      res.statusCode = 400
      // Long enough for koa-compress to compress what is sent back.
      res.end(JSON.stringify({ reason: 'bad input', details: 'x'.repeat(2048) }))
    })
    upstreamURL = await listen(upstream)
  })

  afterAll(async () => {
    agent.destroy()
    await close(upstream)
  })

  beforeEach(() => {
    captured = {}
    rawLogs = []
    delete process.env[RESPONSE_SANITIZER_SWITCH]
    delete process.env.VTEX_APP_LINK
    handler = async ctx => { ctx.body = await callUpstream() }
  })

  afterEach(async () => {
    delete process.env[RESPONSE_SANITIZER_SWITCH]
    if (appServer) {
      await close(appServer)
    }
  })

  describe('control', () => {
    it('keeps the credential on the body when the sanitizer is not registered', async () => {
      await startApp(false)

      const res = await get()

      // The error is circular, so Koa cannot serialize it. The credential is still on the body.
      expect(res.status).toBe(500)
      expect(captured.body.config.headers['Proxy-Authorization']).toBe(TOKEN)
    })
  })

  describe('an error written to the body', () => {
    it('is sent without credentials, config, agents or stack, and compressed', async () => {
      await startApp()

      const res = await get()
      const body = JSON.parse(res.text)

      expect(res.status).toBe(200)
      expect(res.encoding).toBe('gzip')
      expect(res.headers['content-type']).toMatch(/^application\/json/)
      expect(res.text).not.toContain(TOKEN)
      expect(res.text).not.toContain('httpAgent')
      expect(body).toMatchObject({
        code: 'ERR_BAD_REQUEST',
        message: 'Request failed with status code 400',
        name: 'AxiosError',
        response: { status: 400 },
      })
      expect(body).not.toHaveProperty('config')
      expect(body).not.toHaveProperty('request')
      expect(body).not.toHaveProperty('stack')
    })

    it('is sent without credentials when nested in the response', async () => {
      handler = async ctx => {
        const error = await callUpstream()
        ctx.body = { data: { id: 1 }, errors: [{ extensions: { exception: error }, message: 'failed' }] }
      }
      await startApp()

      const res = await get()
      const body = JSON.parse(res.text)

      expect(res.text).not.toContain(TOKEN)
      expect(body.data).toEqual({ id: 1 })
      expect(body.errors[0].message).toBe('failed')
      expect(body.errors[0].extensions.exception.name).toBe('AxiosError')
    })

    it('does not change the status of the response', async () => {
      handler = async ctx => {
        ctx.status = 404
        ctx.body = await callUpstream()
      }
      await startApp()

      const res = await get()

      expect(res.status).toBe(404)
      expect(captured.status).toBe(404)
      expect(res.text).not.toContain(TOKEN)
    })

    it('keeps the content type chosen by the app', async () => {
      handler = async ctx => {
        ctx.body = await callUpstream()
        ctx.type = 'application/vnd.api+json; charset=utf-8'
      }
      await startApp()

      const res = await get()

      expect(res.headers['content-type']).toBe('application/vnd.api+json; charset=utf-8')
      expect(res.text).not.toContain(TOKEN)
    })

    it('is sanitized even if the handler throws afterwards', async () => {
      handler = async ctx => {
        ctx.body = await callUpstream()
        throw new Error('failed after setting the body')
      }
      await startApp()

      const res = await get()

      expect(captured.thrown).toEqual(expect.objectContaining({ message: 'failed after setting the body' }))
      expect(res.status).toBe(500)
      expect(res.text).not.toContain(TOKEN)
      expect(JSON.parse(res.text).name).toBe('AxiosError')
    })

    it('logs how many errors were removed, without any of their content', async () => {
      await startApp()

      await get()

      expect(logs()).toEqual([
        {
          errors: 1,
          message: 'response-sanitizer: error_object_removed',
          reason: 'error_object_removed',
          routeId: 'orders',
        },
      ])
      expect(rawLogs.join()).not.toContain(TOKEN)
    })
  })

  describe('an error turned into a string body', () => {
    // What the finding showed: the error is stringified, so no error object is left in the body.
    const stringifiedFailure = async () => `Error saving size charts: ${stringifyCircular(await callUpstream())}`

    it('is sent without the credential, and compressed', async () => {
      handler = async ctx => {
        ctx.status = 500
        ctx.body = await stringifiedFailure()
      }
      await startApp()

      const res = await get()

      expect(res.status).toBe(500)
      expect(res.encoding).toBe('gzip')
      expect(res.text).not.toContain(TOKEN)
      expect(res.text).toContain('Error saving size charts: ')
      expect(res.text).toContain('Request failed with status code 400')
    })

    it('leaks the credential when the sanitizer is not registered', async () => {
      handler = async ctx => { ctx.body = await stringifiedFailure() }
      await startApp(false)

      const res = await get()

      expect(res.text).toContain(TOKEN)
    })

    it('keeps the content type and the status chosen by the app', async () => {
      handler = async ctx => {
        ctx.status = 502
        ctx.body = await stringifiedFailure()
        ctx.type = 'text/plain; charset=utf-8'
      }
      await startApp()

      const res = await get()

      expect(res.status).toBe(502)
      expect(res.headers['content-type']).toBe('text/plain; charset=utf-8')
    })

    it('has a content length that matches what is sent', async () => {
      // Short enough for compress() to leave it alone, so the length is the one set by the body.
      handler = ctx => {
        ctx.vtex.authToken = TOKEN
        ctx.body = `failed with ${TOKEN}`
      }
      await startApp()

      const res = await get()

      expect(res.encoding).toBeUndefined()
      expect(res.text).toBe(`failed with ${REDACTED}`)
      expect(Number(res.headers['content-length'])).toBe(Buffer.byteLength(res.text))
    })

    it('has the tokens of the request replaced wherever they are', async () => {
      handler = ctx => {
        ctx.vtex.authToken = 'app-token-0123456789abcdef'
        ctx.vtex.adminUserAuthToken = 'admin-token-0123456789abcdef'
        ctx.vtex.storeUserAuthToken = 'store-token-0123456789abcdef'
        ctx.body = 'a=app-token-0123456789abcdef b=admin-token-0123456789abcdef c=store-token-0123456789abcdef'
      }
      await startApp()

      const res = await get()

      expect(res.text).toBe('a=[Redacted] b=[Redacted] c=[Redacted]')
    })

    it('has the token replaced when the handler throws after setting the body', async () => {
      handler = async ctx => {
        ctx.body = await stringifiedFailure()
        throw new Error('failed after setting the body')
      }
      await startApp()

      const res = await get()

      expect(res.status).toBe(500)
      expect(res.text).not.toContain(TOKEN)
    })

    it('logs how many credentials were replaced, without any of them', async () => {
      handler = async ctx => { ctx.body = await stringifiedFailure() }
      await startApp()

      await get()

      expect(logs()).toEqual([
        {
          message: 'response-sanitizer: secret_removed',
          reason: 'secret_removed',
          // The credential is in the headers of the config and in the text of the request.
          redactions: expect.any(Number),
          routeId: 'orders',
        },
      ])
      expect(rawLogs.join()).not.toContain(TOKEN)
    })

    it('is not changed, nor logged, when it has no credential', async () => {
      const text = 'Error saving size charts: Request failed with status code 429'
      handler = ctx => { ctx.body = text }
      await startApp()

      const res = await get()

      expect(captured.body).toBe(text)
      expect(res.text).toBe(text)
      expect(logs()).toEqual([])
    })

    it('is not changed when the sanitizer is switched off', async () => {
      process.env[RESPONSE_SANITIZER_SWITCH] = 'off'
      handler = async ctx => { ctx.body = await stringifiedFailure() }
      await startApp()

      const res = await get()

      expect(res.text).toContain(TOKEN)
    })
  })

  describe('serialized credentials in REST and GraphQL', () => {
    it.each(['rest', 'graphql', 'wrapped-error', 'graphql-engine'])('redacts the %s response over HTTP', async kind => {
      handler = async ctx => {
        const failure = await callUpstream()
        failure.config.headers = { ...failure.config.headers,
          'X-Vtex-Api-AppKey': 'fake-appkey-0123456789',
          'X-Vtex-Api-AppToken': 'fake-apptoken-0123456789',
        }
        const serialized = stringifyCircular(failure.toJSON())
        if (kind === 'graphql-engine') {
          ctx.body = await graphql(buildSchema('type Query { review: String }'), '{ review }', {
            review: () => { throw new Error(serialized) },
          })
          return
        }
        ctx.body = kind === 'rest' ? JSON.parse(serialized)
          : kind === 'wrapped-error' ? new Error(serialized)
          : { data: null, errors: [{ message: serialized, extensions: { exception: { message: serialized } } }] }
      }
      await startApp()
      const res = await get()
      expect(res.status).toBe(200)
      expect(res.text).not.toContain(TOKEN)
      expect(res.text).not.toContain('fake-appkey-0123456789')
      expect(res.text).not.toContain('fake-apptoken-0123456789')
      expect(res.text).toContain('[Redacted]')
    })
  })

  describe('a body without errors', () => {
    it('does not run the copying walk over a list of plain records', async () => {
      const body = { items: Array.from({ length: 500 }, (_, id) => ({ id, name: 'row' })) }
      let walked = false
      jest.resetModules()
      let middleware: (ctx: any, next: () => Promise<void>) => Promise<void>
      jest.isolateModules(() => {
        const sanitizer = require('../../../../../utils/responseSanitizer')
        const original = sanitizer.sanitizeErrors
        jest.spyOn(sanitizer, 'sanitizeErrors').mockImplementation((...args: any[]) => {
          walked = true
          return original(...args)
        })
        middleware = require('./sanitizeResponse').sanitizeResponse
      })
      handler = ctx => { ctx.body = body }
      await startApp(true, middleware!)

      const res = await get()

      expect(walked).toBe(false)
      expect(captured.body).toBe(body)
      expect(JSON.parse(res.text)).toEqual(body)
      expect(logs()).toEqual([])
    })

    it('is the same object, with the same content type', async () => {
      const body = { items: [{ id: 1 }, { id: 2 }], token: 'abc' }
      handler = ctx => {
        ctx.body = body
        ctx.type = 'application/vnd.api+json'
      }
      await startApp()

      const res = await get()

      expect(captured.body).toBe(body)
      expect(res.headers['content-type']).toMatch(/^application\/vnd\.api\+json/)
      expect(JSON.parse(res.text)).toEqual(body)
      expect(logs()).toEqual([])
    })

    it.each([
      ['string', 'plain text'],
      ['buffer', Buffer.from('bytes')],
    ])('is not touched when it is a %s', async (_, body) => {
      handler = ctx => { ctx.body = body }
      await startApp()

      const res = await get()

      expect(captured.body).toBe(body)
      expect(res.status).toBe(200)
    })

    it('is not touched when there is none', async () => {
      handler = ctx => { ctx.status = 204 }
      await startApp()

      const res = await get()

      expect(res.status).toBe(204)
      expect(logs()).toEqual([])
    })
  })

  describe('failures of the sanitizer', () => {
    // An error that is in the body, and a property that makes the walk throw after it.
    const taintedBodyThatBreaksTheWalk = async () => ({
      error: await callUpstream(),
      get list(): number[] {
        throw new Error('getter failed')
      },
    })

    it('withhold the body, with status 500, and are logged with a reason', async () => {
      handler = async ctx => { ctx.body = await taintedBodyThatBreaksTheWalk() }
      await startApp()

      const res = await get()

      expect(res.status).toBe(500)
      expect(JSON.parse(res.text)).toEqual({
        code: 'E_RESPONSE_WITHHELD',
        message: 'The response could not be safely returned.',
      })
      expect(res.text).not.toContain(TOKEN)
      expect(logs()).toEqual([
        {
          errorName: 'Error',
          message: 'response-sanitizer: sanitizer_failed',
          reason: 'sanitizer_failed',
          routeId: 'orders',
        },
      ])
    })

    it('sends a body the walk could not inspect completely, and reports the limit', async () => {
      handler = async ctx => {
        // Deeper than the walk allows, with the credential past the limit. A plain error, so the
        // body can be serialized: an axios error of this version is circular and Koa would fail it.
        const leaked: any = new Error('deep')
        leaked.config = { headers: { authorization: TOKEN } }
        let nested: any = { error: leaked }
        for (let i = 0; i < 40; i++) {
          nested = { child: nested }
        }
        ctx.body = nested
      }
      await startApp()

      const res = await get()

      expect(res.status).toBe(200)
      expect(res.text).toContain(TOKEN)
      expect(res.text).not.toContain('E_RESPONSE_WITHHELD')
      expect(logs()).toEqual([
        {
          message: 'response-sanitizer: limit_reached',
          reason: 'limit_reached',
          routeId: 'orders',
        },
      ])
    })

    it('sends a body that holds more values than the walk accepts, and reports the limit', async () => {
      const body = { ids: new Array(6000000).fill(1) }
      handler = ctx => { ctx.body = body }
      await startApp()

      const res = await get()

      expect(res.status).toBe(200)
      expect(captured.body).toBe(body)
      expect(res.text).not.toContain('E_RESPONSE_WITHHELD')
      expect(logs()).toEqual([
        {
          message: 'response-sanitizer: limit_reached',
          reason: 'limit_reached',
          routeId: 'orders',
        },
      ])
    })

    it('keep an error status chosen by the app', async () => {
      handler = async ctx => {
        ctx.status = 404
        ctx.body = await taintedBodyThatBreaksTheWalk()
      }
      await startApp()

      const res = await get()

      expect(res.status).toBe(404)
      expect(res.text).not.toContain(TOKEN)
    })

    it('withhold the body when the handler throws afterwards too', async () => {
      handler = async ctx => {
        ctx.body = await taintedBodyThatBreaksTheWalk()
        throw new Error('failed after setting the body')
      }
      await startApp()

      const res = await get()

      expect(captured.thrown).toEqual(expect.objectContaining({ message: 'failed after setting the body' }))
      expect(res.text).not.toContain(TOKEN)
      expect(JSON.parse(res.text).code).toBe('E_RESPONSE_WITHHELD')
    })
  })

  describe('together with the error middleware', () => {
    const { error } = require('./error')

    const startAppWithErrorMiddleware = async () => {
      const app = new Koa()
      app.use(async (ctx, next) => {
        ctx.vtex = {
          logger: { log: jest.fn(), warn: (log: any) => rawLogs.push(JSON.stringify(log)) },
          route: { id: 'orders', params: {} },
        }
        await next()
      })
      app.use(error)
      app.use(compress())
      app.use(loadSanitizeResponse() as any)
      app.use(async ctx => { await handler(ctx) })
      appServer = createServer(app.callback())
      appURL = await listen(appServer)
    }

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('does not keep a tainted body when the handler throws after setting it', async () => {
      handler = async ctx => {
        ctx.body = await callUpstream()
        throw new Error('failed while persisting the error')
      }
      await startAppWithErrorMiddleware()

      const res = await get()

      expect(res.status).toBe(500)
      expect(res.text).not.toContain(TOKEN)
      expect(JSON.parse(res.text)).toMatchObject({ name: 'AxiosError' })
    })

    it('does not keep a tainted body when the sanitizer fails and the handler throws', async () => {
      handler = async ctx => {
        ctx.body = {
          error: await callUpstream(),
          get list(): number[] {
            throw new Error('getter failed')
          },
        }
        throw new Error('failed while persisting the error')
      }
      await startAppWithErrorMiddleware()

      const res = await get()

      expect(res.status).toBe(500)
      expect(res.text).not.toContain(TOKEN)
      expect(JSON.parse(res.text).code).toBe('E_RESPONSE_WITHHELD')
    })
  })

  describe(`${RESPONSE_SANITIZER_SWITCH}=off`, () => {
    it('disables the sanitizer', async () => {
      process.env[RESPONSE_SANITIZER_SWITCH] = 'off'
      await startApp()

      const res = await get()

      expect(captured.body.config.headers['Proxy-Authorization']).toBe(TOKEN)
      expect(res.status).toBe(500)
    })
  })

  describe('in a linked app', () => {
    const originalLink = process.env.VTEX_APP_LINK

    afterEach(() => {
      jest.restoreAllMocks()
      if (originalLink === undefined) {
        delete process.env.VTEX_APP_LINK
      } else {
        process.env.VTEX_APP_LINK = originalLink
      }
    })

    it('keeps the stack, still without credentials', async () => {
      process.env.VTEX_APP_LINK = 'vendor.app@0.0.1'
      // This app has no `ctx.vtex`, so the sanitizer logs to the console.
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const app = new Koa()
      app.use(compress())
      app.use(loadSanitizeResponse() as any)
      app.use(async ctx => { ctx.body = await callUpstream() })
      appServer = createServer(app.callback())
      appURL = await listen(appServer)

      const res = await get()
      const body = JSON.parse(res.text)
      expect(body.stack).toEqual(expect.stringContaining('AxiosError'))
      expect(res.text).not.toContain(TOKEN)
      expect(body).not.toHaveProperty('config')
    })
  })
})
