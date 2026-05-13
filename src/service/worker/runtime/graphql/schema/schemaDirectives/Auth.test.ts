import axios from 'axios'

import { Auth } from './Auth'

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
  },
}))

describe('Auth directive', () => {
  class TestAuth extends Auth {
    constructor (args: any) {
      super({
        args,
        context: {},
        name: 'auth',
        schema: {} as any,
        visitedType: {} as any,
      })
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('sends account when validating the VTEX ID token', async () => {
    const request = axios.request as jest.Mock
    request
      .mockResolvedValueOnce({ data: { account: 'storecomponents', user: 'user@example.com' } })
      .mockResolvedValueOnce({ data: true })

    const field = {
      resolve: jest.fn().mockResolvedValue('resolved'),
    } as any
    const directive = new TestAuth({
      productCode: 'product-code',
      resourceCode: 'resource-code',
      scope: 'PRIVATE',
    })
    const ctx = {
      cookies: {
        get: jest.fn().mockReturnValue('vtex-id-token'),
      },
      get: jest.fn(),
      vtex: {
        account: 'storecomponents',
        authToken: 'auth-token',
      },
    } as any

    directive.visitFieldDefinition(field)

    await field.resolve(null, {}, ctx, {})

    const expectedUrl = 'vtexid.vtex.com.br/api/vtexid/pub/authenticated/user?authToken=vtex-id-token&an=storecomponents'

    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      headers: expect.objectContaining({
        'X-VTEX-Proxy-To': `https://${expectedUrl}`,
      }),
      url: `http://${expectedUrl}`,
    }))
  })
})
