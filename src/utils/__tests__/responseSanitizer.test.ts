/**
 * @jest-environment node
 */
import axios, { AxiosError } from 'axios'
import { Agent, createServer, Server } from 'http'
import { Readable } from 'stream'

import { inspect } from 'util'
import { runInNewContext } from 'vm'

import { sanitizeErrors, toLoggableError } from '../responseSanitizer'

const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'
const options = { linked: false }

describe('sanitizeErrors', () => {
  let server: Server
  let baseURL: string
  const agent = new Agent({ keepAlive: false })

  beforeAll(async () => {
    server = createServer((_, res) => {
      res.setHeader('content-type', 'application/json')
      res.setHeader('set-cookie', 'upstream-session=secret-cookie')
      res.statusCode = 400
      res.end(JSON.stringify({ reason: 'bad input' }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
    baseURL = `http://127.0.0.1:${(server.address() as any).port}`
  })

  afterAll(async () => {
    agent.destroy()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  const axiosError = async (): Promise<AxiosError> => {
    try {
      await axios.get(`${baseURL}/endpoint`, {
        headers: { 'Proxy-Authorization': TOKEN, 'X-Vtex-Api-Appkey': 'app-key' },
        httpAgent: agent,
      })
    } catch (e) {
      return e as AxiosError
    }
    throw new Error('the request was expected to fail')
  }

  describe('AxiosError', () => {
    it('reproduces the leak that motivates the sanitizer', async () => {
      const error = await axiosError()

      const serialized = JSON.stringify(error)

      expect(serialized).toContain(TOKEN)
      expect(serialized).toContain('httpAgent')
    })

    it('removes credentials, request config, agents and stack', async () => {
      const error = await axiosError()

      const { value, replaced } = sanitizeErrors(error, options)
      const serialized = JSON.stringify(value)

      expect(replaced).toBe(1)
      expect(serialized).not.toContain(TOKEN)
      expect(serialized).not.toContain('app-key')
      expect(serialized).not.toContain('httpAgent')
      expect(serialized).not.toContain('secret-cookie')
      expect(value).not.toHaveProperty('config')
      expect(value).not.toHaveProperty('request')
      expect(value).not.toHaveProperty('stack')
      expect(value).not.toHaveProperty('response.headers')
      expect(value).not.toHaveProperty('response.request')
      expect(value).not.toHaveProperty('response.config')
      expect(typeof (value as any).toJSON).not.toBe('function')
    })

    it('keeps what describes the failure', async () => {
      const error = await axiosError()

      const { value } = sanitizeErrors(error, options)

      expect(value).toMatchObject({
        code: 'ERR_BAD_REQUEST',
        message: 'Request failed with status code 400',
        name: 'AxiosError',
        response: {
          data: { reason: 'bad input' },
          status: 400,
          statusText: 'Bad Request',
        },
        status: 400,
      })
    })

    it('does not change the received error', async () => {
      const error = await axiosError()

      sanitizeErrors(error, options)

      expect(error.config).toBeDefined()
      expect(error.request).toBeDefined()
      expect(error.stack).toEqual(expect.any(String))
      expect(JSON.stringify(error)).toContain(TOKEN)
    })

    it('keeps the stack when linked, still without credentials', async () => {
      const error = await axiosError()

      const { value } = sanitizeErrors(error, { linked: true })

      expect((value as any).stack).toEqual(expect.stringContaining('AxiosError'))
      expect(JSON.stringify(value)).not.toContain(TOKEN)
      expect(value).not.toHaveProperty('config')
    })

    it('handles the result of an error without response', async () => {
      const error = await axios.get('http://127.0.0.1:1/', { headers: { 'Proxy-Authorization': TOKEN } })
        .catch((e: AxiosError) => e)

      const { value } = sanitizeErrors(error, options)

      expect(JSON.stringify(value)).not.toContain(TOKEN)
      expect(value).toMatchObject({ code: 'ECONNREFUSED' })
      expect(value).not.toHaveProperty('response')
    })
  })

  describe('plain errors', () => {
    it('replaces an Error keeping name and message', () => {
      const { value, replaced } = sanitizeErrors(new TypeError('broken'), options)

      expect(replaced).toBe(1)
      expect(value).toMatchObject({ message: 'broken', name: 'TypeError' })
      expect(value).not.toHaveProperty('stack')
    })

    it('replaces an error created in another realm, which is not an instance of Error', () => {
      const foreign = runInNewContext(`
        const error = new Error('foreign')
        error.config = { headers: { authorization: '${TOKEN}' } }
        error
      `)
      expect(foreign instanceof Error).toBe(false)

      const { value, replaced } = sanitizeErrors({ error: foreign }, options)

      expect(replaced).toBe(1)
      expect(value.error).toMatchObject({ message: 'foreign', name: 'Error' })
      expect(JSON.stringify(value)).not.toContain(TOKEN)
    })

    it('keeps custom enumerable properties and drops private ones', () => {
      class CustomError extends Error {
        public status = 404
        public level = 'warn'
        // tslint:disable-next-line:variable-name
        public _internal = 'hidden'
        public config = { headers: { authorization: TOKEN } }
      }
      const { value } = sanitizeErrors(new CustomError('not here'), options)

      expect(value).toMatchObject({ level: 'warn', message: 'not here', status: 404 })
      expect(value).not.toHaveProperty('_internal')
      expect(value).not.toHaveProperty('config')
      expect(JSON.stringify(value)).not.toContain(TOKEN)
    })

    it('does not expose what a custom toJSON would', () => {
      const error: any = new Error('custom')
      error.toJSON = () => ({ leaked: TOKEN })

      const { value } = sanitizeErrors(error, options)

      expect(JSON.stringify(value)).not.toContain(TOKEN)
    })

    it('replaces errors nested in the properties of an error', async () => {
      const inner = await axiosError()
      const outer: any = new Error('wrapped')
      outer.originalError = inner

      const { value, replaced } = sanitizeErrors(outer, options)

      expect(replaced).toBe(2)
      expect(JSON.stringify(value)).not.toContain(TOKEN)
      expect(value).toHaveProperty('originalError.name', 'AxiosError')
    })

    it('does not lead back to the received error when it references itself', async () => {
      const error: any = await axiosError()
      error.self = error

      const { value } = sanitizeErrors(error, options)

      expect(JSON.stringify(value)).not.toContain(TOKEN)
      expect(value).toHaveProperty('self', '[Circular]')
    })
  })

  describe('what is inside an error', () => {
    const withDetails = (details: unknown) => {
      const error: any = new Error('with details')
      error.details = details
      return error
    }

    it('is cut where the limits are, instead of being handed unbounded to cleanError', () => {
      let deep: any = { leaf: true }
      for (let i = 0; i < 20000; i++) {
        deep = { child: deep }
      }

      const { value, truncated } = sanitizeErrors(withDetails(deep), options)

      expect(truncated).toBe(true)
      expect(() => JSON.stringify(value)).not.toThrow()
      expect(JSON.stringify(value)).toContain('[Truncated]')
    })

    it('is bounded when the same object is referenced many times', () => {
      let shared: any = { leaf: true }
      for (let i = 0; i < 40; i++) {
        shared = { a: shared, b: shared }
      }
      const startedAt = Date.now()

      const { value, truncated } = sanitizeErrors(withDetails(shared), options)

      expect(Date.now() - startedAt).toBeLessThan(5000)
      expect(truncated).toBe(true)
      expect(() => JSON.stringify(value)).not.toThrow()
    })

    it('shows binary data, class instances and dates as markers, not as their contents', () => {
      function Handle(this: any) {
        this.socket = { buffer: Buffer.alloc(10) }
      }
      const details = {
        buffer: Buffer.from('abc'),
        date: new Date('2026-11-06T00:00:00.000Z'),
        handle: new (Handle as any)(),
        typed: new Uint8Array(4),
      }

      const { value } = sanitizeErrors(withDetails(details), options)

      expect((value as any).details).toEqual({
        buffer: '[Buffer 3 bytes]',
        date: '2026-11-06T00:00:00.000Z',
        handle: '[Handle]',
        typed: '[Uint8Array 4 bytes]',
      })
    })

    it('does not report truncation within the limits', () => {
      const result = sanitizeErrors(withDetails({ a: { b: 1 } }), options)

      expect(result.truncated).toBe(false)
    })
  })

  describe('containers', () => {
    it('finds errors at any depth of objects and arrays', async () => {
      const error = await axiosError()
      const body = {
        data: { id: 1 },
        errors: [{ extensions: { exception: error }, message: 'failed' }],
        list: [[error]],
        wrapped: { error },
      }

      const { value, replaced } = sanitizeErrors(body, options)
      const serialized = JSON.stringify(value)

      expect(replaced).toBe(3)
      expect(serialized).not.toContain(TOKEN)
      expect(value.data).toBe(body.data)
      expect(value.errors[0].message).toBe('failed')
      expect(value.wrapped.error).toMatchObject({ name: 'AxiosError' })
    })

    it('returns the same reference when there is nothing to replace', () => {
      const body = { items: [{ id: 1 }, { id: 2 }], nested: { token: 'abc', authorization: { status: 'ok' } } }

      const result = sanitizeErrors(body, options)

      expect(result.value).toBe(body)
      expect(result.replaced).toBe(0)
      expect(result.truncated).toBe(false)
    })

    it('shares the untouched branches with the original', async () => {
      const untouched = { a: 1 }
      const body = { error: await axiosError(), untouched }

      const { value } = sanitizeErrors(body, options)

      expect(value).not.toBe(body)
      expect(value.untouched).toBe(untouched)
      expect(body.error).toBeInstanceOf(Error)
    })

    it('does not mutate frozen bodies', async () => {
      const body = Object.freeze({ list: Object.freeze([await axiosError()]) })

      const { value } = sanitizeErrors(body, options)

      expect(JSON.stringify(value)).not.toContain(TOKEN)
      expect(body.list[0]).toBeInstanceOf(Error)
    })

    it('leaves strings, buffers, streams and class instances alone', () => {
      const buffer = Buffer.from('abc')
      const stream = new Readable({ read() { this.push(null) } })
      // An object that is not a plain one: its prototype is not Object.prototype.
      const wrapper = Object.assign(Object.create({ kind: 'instance' }), { error: new Error('inside an instance') })

      expect(sanitizeErrors('text', options).value).toBe('text')
      expect(sanitizeErrors(buffer, options).value).toBe(buffer)
      expect(sanitizeErrors(stream, options).value).toBe(stream)
      expect(sanitizeErrors(wrapper, options).value).toBe(wrapper)
      expect(sanitizeErrors(null, options).value).toBeNull()
      expect(sanitizeErrors(undefined, options).value).toBeUndefined()
    })

    it('does not walk typed arrays, maps or sets, which have no per-property content to inspect', () => {
      const body = { bytes: new Uint8Array(100000), map: new Map([['a', new Error('in a map')]]), set: new Set() }

      const result = sanitizeErrors(body, options)

      expect(result.value).toBe(body)
      expect(result.replaced).toBe(0)
    })

    it('does not loop on circular bodies', () => {
      const body: any = { a: {} }
      body.a.back = body

      const { value } = sanitizeErrors(body, options)

      expect(value).toBe(body)
    })
  })

  describe('toLoggableError', () => {
    it('prints without credentials, config, request or agents, keeping the stack', async () => {
      const error = await axiosError()

      const printed = inspect(toLoggableError(error), { depth: null })

      expect(printed).not.toContain(TOKEN)
      expect(printed).not.toContain('httpAgent')
      expect(printed).toContain('AxiosError: Request failed with status code 400')
      expect(printed).toContain('    at ')
    })

    it('keeps the class of the error', () => {
      const printed = toLoggableError(new RangeError('out of range'))

      expect(printed).toBeInstanceOf(RangeError)
      expect(inspect(printed)).toContain('RangeError: out of range')
    })

    it('returns what is not an error as it is', () => {
      const body = { a: 1 }

      expect(toLoggableError(body)).toBe(body)
      expect(toLoggableError('text')).toBe('text')
      expect(toLoggableError(undefined)).toBeUndefined()
    })

    it('never throws', () => {
      const hostile = { get list(): number[] { throw new Error('getter failed') } }

      expect(toLoggableError(hostile)).toEqual(expect.stringContaining('could not be sanitized'))
    })
  })

  describe('limits', () => {
    it('stops at the maximum depth and reports it', () => {
      let body: any = { error: new Error('deep') }
      for (let i = 0; i < 5; i++) {
        body = { child: body }
      }

      const result = sanitizeErrors(body, { linked: false, maxDepth: 3 })

      expect(result.truncated).toBe(true)
      expect(result.replaced).toBe(0)
    })

    it('stops at the maximum number of nodes and reports it', () => {
      const body = Array.from({ length: 50 }, (_, id) => ({ id }))

      const result = sanitizeErrors(body, { linked: false, maxNodes: 10 })

      expect(result.truncated).toBe(true)
    })

    it('does not report truncation within the limits', () => {
      const result = sanitizeErrors({ a: [{ b: 1 }] }, { linked: false, maxDepth: 3, maxNodes: 10 })

      expect(result.truncated).toBe(false)
    })
  })
})
