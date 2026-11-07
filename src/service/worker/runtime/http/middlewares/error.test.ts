/**
 * @jest-environment node
 */
import axios, { AxiosError } from 'axios'
import { Agent, createServer, Server } from 'http'
import Koa from 'koa'
import { inspect } from 'util'

import { error } from './error'

const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'

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
        headers: { 'Proxy-Authorization': TOKEN },
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

  const serve = async (handler: () => Promise<void>) => {
    const app = new Koa()
    app.use(async (ctx, next) => {
      ctx.vtex = { logger: { log: jest.fn() }, route: { id: 'orders', params: {} } }
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
    expect(res.status).toBe(400)
    expect(printed).not.toContain(TOKEN)
    expect(printed).not.toContain('httpAgent')
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
