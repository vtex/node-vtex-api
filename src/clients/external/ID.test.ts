const mockHttpClientInstances: any[] = []
const mockGet = jest.fn()

jest.mock('../../HttpClient/HttpClient', () => ({
  HttpClient: jest.fn().mockImplementation((opts) => {
    mockHttpClientInstances.push(opts)
    return {
      get: mockGet,
    }
  }),
}))

import { ID } from './ID'

const context: any = {
  account: 'storecomponents',
  authToken: 'app-auth-token',
}

describe('ID client', () => {
  beforeEach(() => {
    mockHttpClientInstances.length = 0
    mockGet.mockReset()
  })

  it('uses the requesting account commerce stable host', () => {
    const client = new ID(context, {
      headers: {
        'X-Custom-Header': 'custom-value',
      },
    })

    expect(client).toBeDefined()
    expect(mockHttpClientInstances[0]).toMatchObject({
      baseURL: 'http://storecomponents.vtexcommercestable.com.br/api/vtexid/pub/authentication',
      headers: {
        'Proxy-Authorization': 'app-auth-token',
        'X-Custom-Header': 'custom-value',
        'X-VTEX-Proxy-To': 'https://storecomponents.vtexcommercestable.com.br',
      },
    })
  })

  it('keeps the temporary token route and metric', async () => {
    mockGet.mockResolvedValue({ authenticationToken: 'temporary-token' })
    const client = new ID(context)

    await expect(client.getTemporaryToken()).resolves.toBe('temporary-token')

    expect(mockGet).toHaveBeenCalledWith('/start', {
      metric: 'vtexid-temp-token',
      tracing: {
        requestSpanNameSuffix: 'vtexid-temp-token',
      },
    })
  })
})
