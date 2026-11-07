import { REDACTED, redactSecrets } from '../stringRedactor'

const TOKEN = 'eyJhY2NvdW50IjoiY29yZWJpeiJ9.payload-part-123.signature-part-456'

describe('redactSecrets', () => {
  describe('credential headers in JSON text', () => {
    it('replaces the value of an authorization header, keeping the text valid', () => {
      const text = `Error saving size charts: ${JSON.stringify({
        config: { headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' } },
        message: 'Request failed with status code 429',
      })}`

      const { value, redacted } = redactSecrets(text)

      expect(redacted).toBe(1)
      expect(value).not.toContain(TOKEN)
      expect(value).toContain('Request failed with status code 429')
      expect(value).toContain('"content-type":"application/json"')
      expect(JSON.parse(value.slice('Error saving size charts: '.length)).config.headers.authorization).toBe(REDACTED)
    })

    it.each([
      'Authorization',
      'Proxy-Authorization',
      'VtexIdclientAutCookie',
      'X-Vtex-Api-AppKey',
      'x-vtex-api-apptoken',
      'x-vtex-credential',
      'x-vtex-session',
      'cookie',
    ])('finds %s whatever its case', header => {
      const { value, redacted } = redactSecrets(JSON.stringify({ headers: { [header]: TOKEN } }))

      expect(redacted).toBe(1)
      expect(value).not.toContain(TOKEN)
    })

    it('finds the header when the text was serialized twice', () => {
      const once = JSON.stringify({ headers: { authorization: `Bearer ${TOKEN}` } })
      const twice = JSON.stringify({ message: once })

      const { value, redacted } = redactSecrets(twice)

      expect(redacted).toBe(1)
      expect(value).not.toContain(TOKEN)
      expect(() => JSON.parse(value)).not.toThrow()
    })

    it('finds every occurrence', () => {
      const text = JSON.stringify([{ authorization: TOKEN }, { 'proxy-authorization': TOKEN }])

      const { value, redacted } = redactSecrets(text)

      expect(redacted).toBe(2)
      expect(value).not.toContain(TOKEN)
    })

    it('keeps what follows a value that has escaped characters', () => {
      const text = JSON.stringify({ authorization: 'line one\nline two', next: 'kept' })

      const { value } = redactSecrets(text)

      expect(JSON.parse(value)).toEqual({ authorization: REDACTED, next: 'kept' })
    })

    it('does not touch other keys, or keys that only end with a credential name', () => {
      const text = JSON.stringify({ token: 'abc', 'x-authorization': 'abc', authorizationUrl: 'https://x.test' })

      const result = redactSecrets(text)

      expect(result.redacted).toBe(0)
      expect(result.value).toBe(text)
    })

    it('does not count a value that is already redacted', () => {
      const text = JSON.stringify({ authorization: REDACTED })

      const result = redactSecrets(text)

      expect(result.redacted).toBe(0)
      expect(result.value).toBe(text)
    })

    it('leaves an empty value alone', () => {
      expect(redactSecrets('{"authorization":""}').redacted).toBe(0)
    })
  })

  describe('header lines', () => {
    it('replaces the value in a serialized request, where headers are lines of text', () => {
      const request = `GET /orders HTTP/1.1\r\nAccept: */*\r\nProxy-Authorization: ${TOKEN}\r\nHost: api.test\r\n\r\n`
      const text = JSON.stringify({ request: { _header: request } })

      const { value, redacted } = redactSecrets(text)

      expect(redacted).toBe(1)
      expect(value).not.toContain(TOKEN)
      expect(JSON.parse(value).request._header).toBe(
        'GET /orders HTTP/1.1\r\nAccept: */*\r\nProxy-Authorization: [Redacted]\r\nHost: api.test\r\n\r\n'
      )
    })

    it('replaces the value in text that has real line breaks', () => {
      const { value } = redactSecrets(`Authorization: ${TOKEN}\r\nHost: api.test`)

      expect(value).toBe('Authorization: [Redacted]\r\nHost: api.test')
    })

    it('replaces a session line and a cookie line, which the keyed form already covers', () => {
      const request = [
        'GET /orders HTTP/1.1',
        `Cookie: vtex_session=${TOKEN}; theme=dark`,
        `X-Vtex-Session: ${TOKEN}`,
        `Set-Cookie: checkout=${TOKEN}; Path=/; HttpOnly`,
        'Host: api.test',
        '',
        '',
      ].join('\r\n')

      const { value, redacted } = redactSecrets(JSON.stringify({ request: { _header: request } }))
      const header = JSON.parse(value).request._header as string

      expect(redacted).toBe(3)
      expect(header).not.toContain(TOKEN)
      expect(header).toContain('Cookie: [Redacted]\r\n')
      expect(header).toContain('X-Vtex-Session: [Redacted]\r\n')
      expect(header).toContain('Set-Cookie: [Redacted]\r\n')
      expect(header).toContain('Host: api.test')
    })

    it('does not touch a short value, which is not a credential', () => {
      const text = 'Authorization: missing'

      expect(redactSecrets(text).value).toBe(text)
    })
  })

  describe('the VTEX ID cookie', () => {
    it.each([
      'VtexIdclientAutCookie',
      'VtexIdclientAutCookie_corebiz',
    ])('replaces the value of %s, keeping the other cookies', name => {
      const text = `Set-Cookie line: other=1; ${name}=${TOKEN}; theme=dark`

      const { value, redacted } = redactSecrets(text)

      expect(redacted).toBe(1)
      expect(value).toBe(`Set-Cookie line: other=1; ${name}=[Redacted]; theme=dark`)
    })

    it('replaces a whole cookie header that is a value in JSON text', () => {
      const text = JSON.stringify({ cookie: `other=1; VtexIdclientAutCookie=${TOKEN}` })

      const { value } = redactSecrets(text)

      expect(value).not.toContain(TOKEN)
    })

    it('does not touch other cookies, nor ordinary text that starts with the word Cookie', () => {
      const text = 'Cookie: we use cookies to improve this page; theme=dark'

      expect(redactSecrets(text).value).toBe(text)
    })
  })

  describe('bearer tokens', () => {
    it('replaces the token that follows Bearer', () => {
      const { value, redacted } = redactSecrets(`upstream said: Bearer ${TOKEN} was rejected`)

      expect(redacted).toBe(1)
      expect(value).toBe(`upstream said: Bearer ${REDACTED} was rejected`)
    })

    it('replaces the whole value of an Authorization line, scheme included', () => {
      const { value } = redactSecrets(`Authorization: Bearer ${TOKEN}\r\nHost: api.test`)

      expect(value).toBe('Authorization: [Redacted]\r\nHost: api.test')
    })

    it('does not touch ordinary text that mentions the word', () => {
      const text = 'The bearer of this letter should be admitted'

      expect(redactSecrets(text).value).toBe(text)
    })
  })

  describe('known secrets', () => {
    it('replaces them wherever they appear', () => {
      const { value, redacted } = redactSecrets(`failed with ${TOKEN}, retried with ${TOKEN}`, [TOKEN])

      expect(redacted).toBe(2)
      expect(value).toBe(`failed with ${REDACTED}, retried with ${REDACTED}`)
    })

    it('ignores secrets that are missing or too short to be told apart from text', () => {
      const text = 'the id is 1234 and the name is abc'

      const result = redactSecrets(text, [undefined, '', '1234', 'abc'])

      expect(result.redacted).toBe(0)
      expect(result.value).toBe(text)
    })
  })

  it('returns the same string when there is nothing to replace', () => {
    const text = 'Error saving size charts: Request failed with status code 429'

    const result = redactSecrets(text, [TOKEN])

    expect(result.redacted).toBe(0)
    expect(result.value).toBe(text)
  })

  it('stays fast on a large text that has nothing to replace', () => {
    const text = JSON.stringify(Array.from({ length: 100000 }, (_, id) => ({ id, name: 'row', note: '"quoted"  ' })))
    const startedAt = Date.now()

    const result = redactSecrets(text, [TOKEN])

    expect(result.redacted).toBe(0)
    expect(Date.now() - startedAt).toBeLessThan(2000)
  })

  it('stays fast on text built to make a pattern backtrack', () => {
    const text = '"authorization":"' + '\\a'.repeat(200000)
    const startedAt = Date.now()

    redactSecrets(text)

    expect(Date.now() - startedAt).toBeLessThan(2000)
  })
})
