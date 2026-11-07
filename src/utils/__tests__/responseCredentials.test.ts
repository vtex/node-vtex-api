import { inspectionFailureReason, sanitizeCredentials } from '../responseCredentials'

const secret = 'FAKE_SECRET_01234567890123456789'
const headers = {
  'Proxy-Authorization': secret,
  VtexIdclientAutCookie: secret,
  'X-Vtex-Api-AppKey': secret,
  'X-Vtex-Api-AppToken': secret,
}

// Matches the public REST and GraphQL response shapes, without real credentials.
describe('response credentials', () => {
  it.each([
    ['REST serialized Axios', { name: 'AxiosError', config: { headers } }],
    ['GraphQL nested messages', { data: null, errors: [{
      extensions: { exception: { message: JSON.stringify({ config: { headers } }) } },
      message: JSON.stringify({ config: { headers } }),
    }] }],
    ['nested array', [{ details: [JSON.stringify({ config: { headers } })] }]],
  ])('redacts %s without mutating the original', (_, body) => {
    const before = JSON.stringify(body)
    const result = sanitizeCredentials(body)
    expect(JSON.stringify(result.value)).not.toContain(secret)
    expect(JSON.stringify(result.value)).toContain('[Redacted]')
    expect(JSON.stringify(body)).toBe(before)
  })

  it('redacts duplicated GraphQL messages containing prefixed serialized errors', () => {
    const message = `upstream failed: ${JSON.stringify({ config: { headers }, name: 'AxiosError' })}`
    const body = { data: null, errors: [{ extensions: { exception: { message } }, message }] }
    const result = sanitizeCredentials(body)
    expect(JSON.stringify(result.value)).not.toContain(secret)
    expect(result.redacted).toBe(8)
    expect(result.truncated).toBe(false)
    expect(body.errors[0].message).toBe(message)
  })

  it('preserves an ordinary upstream error message without credentials', () => {
    const body = { message: 'Request failed with status code 400' }
    const result = sanitizeCredentials(body)
    expect(result.value).toBe(body)
    expect(result.redacted).toBe(0)
    expect(result.truncated).toBe(false)
  })

  it('replaces context tokens even without a header name', () => {
    expect(sanitizeCredentials({ message: `failed ${secret}` }, [secret]).value)
      .toEqual({ message: 'failed [Redacted]' })
  })

  it('rejects custom serialization that could expose unchecked credentials', () => {
    expect(() => sanitizeCredentials({ toJSON: () => ({ headers }) })).toThrow()
  })

  it('does not evaluate response accessors', () => {
    const getter = jest.fn(() => secret)
    const body = Object.defineProperty({}, 'message', { enumerable: true, get: getter })
    expect(() => sanitizeCredentials(body)).toThrow()
    expect(getter).not.toHaveBeenCalled()
  })

  it('keeps clean payload references', () => {
    const body = { data: [{ id: 1, text: 'ordinary message' }] }
    expect(sanitizeCredentials(body).value).toBe(body)
  })

  it('preserves a body beyond the inspection depth and reports truncation', () => {
    let body: any = { config: { headers } }
    for (let i = 0; i < 40; i++) { body = { child: body } }
    const result = sanitizeCredentials(body)
    expect(result.value).toBe(body)
    expect(result.truncated).toBe(true)
  })

  it('keeps completed redactions when a later value exceeds the text budget', () => {
    const text = 'x'.repeat(16 * 1024 * 1024 + 1)
    const body = { headers, text }
    const result = sanitizeCredentials(body)
    expect(result.value.headers['Proxy-Authorization']).toBe('[Redacted]')
    expect(result.value.text).toBe(text)
    expect(result.truncated).toBe(true)
    expect(body.headers['Proxy-Authorization']).toBe(secret)
  })

  it('preserves a container beyond the value budget', () => {
    const body = new Array(5000001).fill(1)
    const result = sanitizeCredentials(body)
    expect(result.value).toBe(body)
    expect(result.truncated).toBe(true)
  })
})


describe('inspection diagnostics', () => {
  const cycle: any = {}
  cycle.self = cycle
  const date = new Date()
  date.toJSON = () => secret
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get: () => secret })

  it.each([
    ['cycle', cycle],
    ['custom_serialization', { toJSON: () => secret }],
    ['custom_date_serialization', date],
    ['unsupported_object', new Map()],
    ['accessor', accessor],
  ])('reports a fixed reason for %s', (reason, body) => {
    expect.assertions(2)
    try {
      sanitizeCredentials(body)
    } catch (error) {
      expect(inspectionFailureReason(error)).toBe(reason)
      expect(String(error)).not.toContain(secret)
    }
  })

  it('does not expose unexpected exception messages', () => {
    expect(inspectionFailureReason(new Error(secret))).toBe('unexpected_failure')
  })

  it('ignores empty and short context tokens without copying a clean body', () => {
    const body = { message: 'abc upstream failed' }
    const result = sanitizeCredentials(body, ['', undefined, 'abc'])
    expect(result.value).toBe(body)
    expect(result.redacted).toBe(0)
  })
})
