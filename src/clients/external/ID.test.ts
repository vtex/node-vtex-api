import { ID } from './ID'

jest.mock('./ExternalClient', () => ({
  ExternalClient: class {
    protected context: any
    protected http: any
    protected options: any

    constructor (baseURL: string, context: any, options: any) {
      this.context = context
      this.http = { get: jest.fn() }
      this.options = options
    }
  },
}))

describe('ID client', () => {
  const context: any = {
    account: 'storecomponents',
    authToken: 'auth-token',
  }

  const createClientWithMockedGet = () => {
    const client = new ID(context)
    const get = jest.fn().mockResolvedValue({ authenticationToken: 'temporary-token' })

    ;(client as any).http = { get }

    return { client, get }
  }

  test('sets the account as a default query parameter', () => {
    const client = new ID(context)

    expect((client as any).options.params).toEqual({
      an: context.account,
    })
  })

  test('preserves custom default query parameters', () => {
    const client = new ID(context, {
      params: {
        locale: 'en-US',
      },
    })

    expect((client as any).options.params).toEqual({
      an: context.account,
      locale: 'en-US',
    })
  })

  test('requests temporary tokens without overriding default account params', async () => {
    const { client, get } = createClientWithMockedGet()

    await client.getTemporaryToken()

    expect(get).toHaveBeenCalledWith('/start', expect.not.objectContaining({
      params: expect.anything(),
    }))
  })

  test('sends account on email code requests', async () => {
    const { client, get } = createClientWithMockedGet()

    await client.sendCodeToEmail('authentication-token', 'user@example.com')

    expect(get).toHaveBeenCalledWith('/accesskey/send', expect.objectContaining({
      params: {
        authenticationToken: 'authentication-token',
        email: 'user@example.com',
      },
    }))
  })

  test('sends account on access key validation requests', async () => {
    const { client, get } = createClientWithMockedGet()

    await client.getEmailCodeAuthenticationToken('authentication-token', 'user@example.com', '123456')

    expect(get).toHaveBeenCalledWith('/accesskey/validate', expect.objectContaining({
      params: {
        accesskey: '123456',
        authenticationToken: 'authentication-token',
        login: 'user@example.com',
      },
    }))
  })

  test('sends account on password validation requests', async () => {
    const { client, get } = createClientWithMockedGet()

    await client.getPasswordAuthenticationToken('authentication-token', 'user@example.com', 'password')

    expect(get).toHaveBeenCalledWith('/classic/validate', expect.objectContaining({
      params: {
        authenticationToken: 'authentication-token',
        login: 'user@example.com',
        password: 'password',
      },
    }))
  })
})
