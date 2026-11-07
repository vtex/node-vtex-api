/**
 * @jest-environment node
 */
import axios, { AxiosError } from 'axios'
import { Agent, createServer, Server } from 'http'
import Koa from 'koa'
import { inspect } from 'util'

import { error } from './error'

const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'
// A credential in a header that `cleanError` does not know about.
const CREDENTIAL = 'credential-value-0123456789'

describe('error middleware', () => {
  const agent = new Agent({ keepAlive: false })
  let upstream: Server
  let upstreamURL: string
  let appServer: Server
  let appURL: string

  const listen = (server: Server) =>
    new Promise<string>(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as any).port}`)))

  const close = (server: Server) => new Promise<void>(resolve => server.close(() => resolve()))

  const failingUpstreamCall = async (): Promise<AxiosError> => {
    try {
      await axios.get(`${upstreamURL}/orders`, {
        headers: { 'Proxy-Authorization': TOKEN, 'X-Vtex-Credential': CREDENTIAL },
        httpAgent: agent,
      })
    } catch (e) {
      return e as AxiosError
    }
    throw new Error('the upstream call was expected to fail')
  }

  beforeAll(async () => {
    upstream = createServer((_, res) => {
      res.statusCode = 400
      res.end('bad request')
    })
    upstreamURL = await listen(upstream)
  })

  afterAll(async () => {
    agent.destroy()
    await close(upstream)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    if (appServer) {
      await close(appServer)
    }
  })

  const serve = async (handler: () => Promise<void>, vtex: Record<string, any> = {}) => {
    const app = new Koa()
    app.use(async (ctx, next) => {
      ctx.vtex = { logger: { log: jest.fn() }, route: { id: 'orders', params: {} }, ...vtex }
      await next()
    })
    app.use(error)
    app.use(async () => { await handler() })
    appServer = createServer(app.callback())
    appURL = await listen(appServer)
    return axios.get(appURL, { httpAgent: agent, validateStatus: () => true })
  }

  it('prints the raw error with the credential, which is why it must not be printed', async () => {
    const raw = await failingUpstreamCall()

    expect(inspect(raw)).toContain(TOKEN)
  })

  it('does not write credentials to the process output', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const res = await serve(async () => { throw await failingUpstreamCall() })

    const printed = inspect(consoleError.mock.calls, { depth: null, maxArrayLength: null })
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    expect(res.status).toBe(400)
    expect(body).not.toContain(TOKEN)
    expect(res.data).not.toHaveProperty('config')
    expect(res.data).not.toHaveProperty('request')
    expect(printed).not.toContain(TOKEN)
    expect(printed).not.toContain('httpAgent')
  })

  describe('the body it builds from a thrown value', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    it('keeps what a client needs from a thrown axios error', async () => {
      const res = await serve(async () => { throw await failingUpstreamCall() })

      expect(res.status).toBe(400)
      expect(res.data).toMatchObject({
        code: 'ERR_BAD_REQUEST',
        message: 'Request failed with status code 400',
        name: 'AxiosError',
        response: { data: 'bad request', status: 400 },
        status: 400,
      })
      // What the upstream answered is kept; its headers are not.
      expect(res.data.response).not.toHaveProperty('headers')
    })

    it('does not expose an error that is a property of the thrown one', async () => {
      const res = await serve(async () => {
        throw Object.assign(new Error('wrapped'), { originalError: await failingUpstreamCall() })
      })

      const body = JSON.stringify(res.data)
      expect(body).not.toContain(TOKEN)
      expect(body).not.toContain(CREDENTIAL)
      expect(res.data.originalError).toMatchObject({ code: 'ERR_BAD_REQUEST', name: 'AxiosError', status: 400 })
      expect(res.data.originalError).not.toHaveProperty('config')
      expect(res.data.originalError).not.toHaveProperty('request')
      expect(res.data.originalError).not.toHaveProperty('stack')
    })

    it('does not expose an error inside a thrown plain object', async () => {
      const res = await serve(async () => {
        // tslint:disable-next-line:no-string-throw
        throw { error: await failingUpstreamCall(), status: 502 }
      })

      const body = JSON.stringify(res.data)
      expect(res.status).toBe(502)
      expect(body).not.toContain(TOKEN)
      expect(body).not.toContain(CREDENTIAL)
      expect(res.data.error).toMatchObject({ name: 'AxiosError' })
      expect(res.data.error).not.toHaveProperty('config')
    })

    it('replaces the tokens of the request embedded in a thrown message', async () => {
      const res = await serve(async () => { throw new Error(`failed: ${TOKEN}`) }, { authToken: TOKEN })

      expect(res.status).toBe(500)
      expect(res.data.message).toBe('failed: [Redacted]')
    })

    it('replaces the tokens of the request in a thrown error that embeds a serialized axios error', async () => {
      const res = await serve(async () => {
        throw new Error(`failed: ${JSON.stringify(await failingUpstreamCall())}`)
      }, { authToken: TOKEN })

      expect(JSON.stringify(res.data)).not.toContain(TOKEN)
      expect(res.data.message).toContain('failed: ')
    })

    it('withholds the body when the error cannot be sanitized', async () => {
      const responseSanitizer = require('../../../../../utils/responseSanitizer')
      jest.spyOn(responseSanitizer, 'sanitizeErrors').mockImplementation(() => {
        throw new TypeError('sanitizer broke')
      })

      const res = await serve(async () => { throw await failingUpstreamCall() })

      expect(res.status).toBe(400)
      expect(res.data).toEqual({
        code: 'E_RESPONSE_WITHHELD',
        message: 'The response could not be safely returned.',
      })
      expect(JSON.stringify(res.data)).not.toContain(TOKEN)
    })
  })

  it('still writes what is needed to debug: the error, its stack and its properties', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await serve(async () => { throw await failingUpstreamCall() })

    const [label, printedError] = consoleError.mock.calls[0]
    expect(label).toBe('[node-vtex-api error]')
    expect(printedError).toBeInstanceOf(Error)
    expect(inspect(printedError)).toEqual(expect.stringContaining('AxiosError: Request failed with status code 400'))
    expect(inspect(printedError)).toEqual(expect.stringContaining('    at '))
    expect(inspect(printedError)).toEqual(expect.stringContaining('ERR_BAD_REQUEST'))
  })

  it('writes errors that are not axios errors as errors too', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await serve(async () => { throw new TypeError('broken') })

    const [, printedError] = consoleError.mock.calls[0]
    expect(printedError).toBeInstanceOf(TypeError)
    expect(inspect(printedError)).toEqual(expect.stringContaining('TypeError: broken'))
  })
})
