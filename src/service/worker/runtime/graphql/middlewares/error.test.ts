/**
 * @jest-environment node
 */

// The middleware reads whether the app is linked when it is loaded, so each use gets a fresh copy.
const loadGraphqlError = (): typeof import('./error').graphqlError => {
  let loaded: any
  jest.resetModules()
  jest.isolateModules(() => {
    loaded = require('./error').graphqlError
  })
  return loaded
}

const buildCtx = () => ({
  graphql: {
    cacheControl: {} as any,
    graphqlResponse: undefined as any,
    query: {},
    status: undefined as any,
  },
  headers: {},
  request: { is: () => false },
  set: jest.fn(),
  status: 200,
  vtex: {
    logger: { log: jest.fn() },
    operationId: 'operation',
    production: true,
    requestId: 'request',
    route: { id: 'graphql' },
  },
})

const throwing = () => {
  const failure: any = new Error('resolver failed')
  failure.path = ['orders']
  return async () => { throw failure }
}

describe('graphqlError', () => {
  const originalLink = process.env.VTEX_APP_LINK

  beforeEach(() => {
    delete process.env.VTEX_APP_LINK
  })

  afterEach(() => {
    if (originalLink === undefined) {
      delete process.env.VTEX_APP_LINK
    } else {
      process.env.VTEX_APP_LINK = originalLink
    }
  })

  it('does not return the stack in the errors of the response', async () => {
    const ctx = buildCtx()

    await loadGraphqlError()(ctx as any, throwing())

    const [responseError] = ctx.graphql.graphqlResponse.errors
    expect(responseError).toMatchObject({ message: 'resolver failed' })
    expect(responseError).not.toHaveProperty('stack')
    expect(JSON.stringify(ctx.graphql.graphqlResponse)).not.toContain('graphql/middlewares/error.test')
  })

  it('does not return the stack of errors reported by the graphql engine either', async () => {
    const ctx = buildCtx()
    const { GraphQLError } = require('graphql')
    const engineError = new GraphQLError('engine failed', undefined, undefined, undefined, ['orders'], new Error('resolver failed'))

    await loadGraphqlError()(ctx as any, async () => {
      ctx.graphql.graphqlResponse = { errors: [engineError] }
    })

    const [responseError] = ctx.graphql.graphqlResponse.errors
    expect(responseError).toMatchObject({ message: 'engine failed' })
    expect(responseError).not.toHaveProperty('stack')
    expect(JSON.stringify(ctx.graphql.graphqlResponse)).not.toContain('graphql/middlewares/error.test')
  })

  it('does not return what is kept only for the logs', async () => {
    const ctx = buildCtx()
    const failure: any = new Error('resolver failed')
    failure.config = { headers: { 'proxy-authorization': 'a-credential' } }
    failure.request = { path: '/orders' }

    await loadGraphqlError()(ctx as any, async () => { throw failure })

    const serialized = JSON.stringify(ctx.graphql.graphqlResponse)
    expect(serialized).not.toContain('a-credential')
    expect(serialized).not.toContain('sensitive')
  })

  it('still logs the stack', async () => {
    const ctx = buildCtx()

    await loadGraphqlError()(ctx as any, throwing())

    expect(ctx.vtex.logger.log).toHaveBeenCalledTimes(1)
    expect(ctx.vtex.logger.log.mock.calls[0][0].stack).toEqual(expect.stringContaining('resolver failed'))
  })

  it('keeps the stack in a linked app', async () => {
    process.env.VTEX_APP_LINK = 'vendor.app@0.0.1'
    const ctx = buildCtx()

    await loadGraphqlError()(ctx as any, throwing())

    expect(ctx.graphql.graphqlResponse.errors[0].stack).toEqual(expect.stringContaining('resolver failed'))
  })

  describe('the tokens of the request', () => {
    // Fake credential only.
    const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'

    it('are replaced in the message and the extensions of a thrown error', async () => {
      const ctx = buildCtx()
      ;(ctx.vtex as any).authToken = TOKEN
      const failure: any = new Error(`upstream failed: {"headers":{"proxy-authorization":"${TOKEN}"}}`)
      failure.path = ['orders']
      failure.details = { echoed: TOKEN }

      await loadGraphqlError()(ctx as any, async () => { throw failure })

      const response = JSON.stringify(ctx.graphql.graphqlResponse)
      expect(response).not.toContain(TOKEN)
      expect(ctx.graphql.graphqlResponse.errors[0].message).toBe('upstream failed: {"headers":{"proxy-authorization":"[Redacted]"}}')
    })

    it('are replaced in errors reported by the engine, and data is not touched', async () => {
      const ctx = buildCtx()
      ;(ctx.vtex as any).storeUserAuthToken = TOKEN
      const { GraphQLError } = require('graphql')
      const engineError = new GraphQLError(`engine failed with ${TOKEN}`, undefined, undefined, undefined, ['orders'], new Error('resolver failed'))
      const data = { session: { namespaces: { cookie: { value: TOKEN } } } }

      await loadGraphqlError()(ctx as any, async () => {
        ctx.graphql.graphqlResponse = { data, errors: [engineError] }
      })

      expect(ctx.graphql.graphqlResponse.errors[0].message).toBe('engine failed with [Redacted]')
      expect(ctx.graphql.graphqlResponse.data).toBe(data)
    })

    it('are replaced in what an extension with its own toJSON serializes to', async () => {
      const ctx = buildCtx()
      ;(ctx.vtex as any).authToken = TOKEN
      const { GraphQLError } = require('graphql')
      const engineError = new GraphQLError('engine failed', undefined, undefined, undefined, ['orders'], undefined, {
        leak: { toJSON: () => ({ exposed: TOKEN }) },
      })

      await loadGraphqlError()(ctx as any, async () => {
        ctx.graphql.graphqlResponse = { errors: [engineError] }
      })

      expect(JSON.stringify(ctx.graphql.graphqlResponse)).not.toContain(TOKEN)
    })

    it('are still logged as they were, for debugging', async () => {
      const ctx = buildCtx()
      ;(ctx.vtex as any).authToken = TOKEN
      const failure: any = new Error('plain failure without secrets')
      failure.path = ['orders']

      await loadGraphqlError()(ctx as any, async () => { throw failure })

      expect(ctx.graphql.graphqlResponse.errors[0].message).toBe('plain failure without secrets')
      expect(ctx.vtex.logger.log).toHaveBeenCalled()
    })
  })

  describe('when the errors cannot be redacted', () => {
    // Fake credential only.
    const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'

    afterEach(() => jest.dontMock('../../utils/redactErrorBody'))

    it('still answers with each error message, path and code, without the tokens', async () => {
      jest.doMock('../../utils/redactErrorBody', () => ({ redactErrorBody: () => { throw new TypeError('hostile') } }))
      const graphqlError = loadGraphqlError()
      const ctx = buildCtx()
      ;(ctx.vtex as any).authToken = TOKEN
      const failure: any = new Error(`upstream failed: ${TOKEN}`)
      failure.path = ['orders', 0, TOKEN]
      failure.extensions = { code: `E_${TOKEN}` }
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await graphqlError(ctx as any, async () => { throw failure })

      const [error] = ctx.graphql.graphqlResponse.errors
      expect(error.message).toBe('upstream failed: [Redacted]')
      expect(error.path).toEqual(['orders', 0, '[Redacted]'])
      expect(JSON.stringify(ctx.graphql.graphqlResponse)).not.toContain(TOKEN)
      consoleError.mockRestore()
    })

    it('still answers with valid errors when their extensions cannot be serialized', async () => {
      const ctx = buildCtx()
      const { GraphQLError } = require('graphql')
      const engineError = new GraphQLError('engine failed', undefined, undefined, undefined, ['orders'], undefined, {
        code: 'E_ORDERS',
        toJSON: () => { throw new Error('boom') },
      })
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await loadGraphqlError()(ctx as any, async () => {
        ctx.graphql.graphqlResponse = { errors: [engineError] }
      })

      const [error] = ctx.graphql.graphqlResponse.errors
      expect(error.message).toBe('engine failed')
      expect(error.path).toEqual(['orders'])
      expect(error.extensions === undefined || (typeof error.extensions === 'object' && !Array.isArray(error.extensions))).toBe(true)
      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })
})
