import { BODY_HASH } from '../constants'
import { computeBodyHash } from '../utils/bodyHash'
import { HttpClient } from './HttpClient'

function createClient(): HttpClient {
  const logger = { warn: jest.fn() }
  const tracer = { isTraceSampled: false }

  const client = new HttpClient({
    account: 'test-account',
    logger,
    tracer,
    workspace: 'master',
  } as any)

  // Bypass the real middleware pipeline (network, tracing, metrics) - this test
  // only exercises getWithBody's own bodyHash/config-building logic.
  ;(client as any).request = jest.fn().mockResolvedValue({ data: 'ok' })

  return client
}

describe('HttpClient#getWithBody', () => {
  it('passes a bodyHash computed by computeBodyHash as the BODY_HASH param for a Buffer body', async () => {
    const client = createClient()
    const buffer = Buffer.from([1, 2, 3, 4, 5])

    await client.getWithBody('/some-url', buffer)

    const requestMock = (client as any).request as jest.Mock
    const passedConfig = requestMock.mock.calls[0][0]

    expect(passedConfig.data).toBe(buffer)
    expect(passedConfig.params[BODY_HASH]).toBe(computeBodyHash(buffer))
  })

  it('passes a bodyHash computed by computeBodyHash as the BODY_HASH param for a plain object body', async () => {
    const client = createClient()
    const data = { a: 1, b: 2 }

    await client.getWithBody('/some-url', data)

    const requestMock = (client as any).request as jest.Mock
    const passedConfig = requestMock.mock.calls[0][0]

    expect(passedConfig.params[BODY_HASH]).toBe(computeBodyHash(data))
  })

  it('overrides a caller-supplied BODY_HASH param with the computed hash', async () => {
    const client = createClient()
    const data = { a: 1, b: 2 }

    await client.getWithBody('/some-url', data, { params: { [BODY_HASH]: 'caller-supplied-hash' } })

    const requestMock = (client as any).request as jest.Mock
    const passedConfig = requestMock.mock.calls[0][0]

    expect(passedConfig.params[BODY_HASH]).toBe(computeBodyHash(data))
    expect(passedConfig.params[BODY_HASH]).not.toBe('caller-supplied-hash')
  })

  it('resolves with the response data', async () => {
    const client = createClient()

    const result = await client.getWithBody('/some-url', { a: 1 })

    expect(result).toBe('ok')
  })
})
