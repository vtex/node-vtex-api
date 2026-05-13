import { AuthenticationError } from 'apollo-server-errors'
import axios from 'axios'

import { Auth } from './Auth'

jest.mock('axios', () => ({
  request: jest.fn(),
}))

const request = axios.request as jest.Mock

function makeContext(overrides: Partial<any> = {}): any {
  return {
    cookies: {
      get: jest.fn((name: string) => name === 'VtexIdclientAutCookie' ? 'valid-vtex-id-token' : undefined),
    },
    get: jest.fn(),
    vtex: {
      account: 'storecomponents',
      authToken: 'app-auth-token',
    },
    ...overrides,
  }
}

function wrapResolver(args = { productCode: '38', resourceCode: 'cms_settings', scope: 'PRIVATE' }) {
  const directive = Object.create(Auth.prototype)
  directive.args = args

  const resolve = jest.fn().mockResolvedValue('resolver-result')
  const field: any = { resolve }
  directive.visitFieldDefinition(field)

  return { field, resolve }
}

describe('Auth directive', () => {
  beforeEach(() => {
    request.mockReset()
  })

  it('validates the VTEX ID token against the requesting account commerce stable host', async () => {
    request
      .mockResolvedValueOnce({ data: { user: 'victor.moura@vtex.com', account: 'storecomponents' } })
      .mockResolvedValueOnce({ data: true })

    const { field } = wrapResolver()

    await expect(field.resolve({}, {}, makeContext(), {})).resolves.toBe('resolver-result')

    expect(request).toHaveBeenNthCalledWith(1, {
      data: {
        token: 'valid-vtex-id-token',
      },
      headers: {
        Accept: 'application/json',
        Authorization: 'app-auth-token',
        'Content-Type': 'application/json',
        'X-VTEX-Proxy-To': 'https://storecomponents.vtexcommercestable.com.br',
      },
      method: 'post',
      url: 'http://storecomponents.vtexcommercestable.com.br/api/vtexid/credential/validate?an=storecomponents',
    })
  })

  it('rejects tokens validated for a different account', async () => {
    request.mockResolvedValueOnce({ data: { user: 'victor.moura@vtex.com', account: 'otheraccount' } })

    const { field } = wrapResolver()

    await expect(field.resolve({}, {}, makeContext(), {})).rejects.toThrow(AuthenticationError)

    expect(request).toHaveBeenCalledTimes(1)
  })
})
