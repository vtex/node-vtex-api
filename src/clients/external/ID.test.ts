import { ID } from './ID'

jest.mock('./ExternalClient', () => ({
  ExternalClient: class {
    protected context: any
    protected http: any

    constructor (baseURL: string, context: any) {
      this.context = context
      this.http = { get: jest.fn() }
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

  test('sends account on temporary token requests', async () => {
    const { client, get } = createClientWithMockedGet()

    await client.getTemporaryToken()

    expect(get).toHaveBeenCalledWith('/start', expect.objectContaining({
      params: {
        an: context.account,
      },
    }))
  })

  test('sends account on email code requests', async () => {
    const { client, get } = createClientWithMockedGet()

    await client.sendCodeToEmail('authentication-token', 'user@example.com')

    expect(get).toHaveBeenCalledWith('/accesskey/send', expect.objectContaining({
      params: {
        an: context.account,
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
        an: context.account,
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
        an: context.account,
        authenticationToken: 'authentication-token',
        login: 'user@example.com',
        password: 'password',
      },
    }))
  })
})
