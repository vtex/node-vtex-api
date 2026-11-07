import {
  isKnownCredentialHeaderName,
  isSensitiveHeaderName,
  isSensitiveParamName,
  redactCredentialFields,
  redactRequestData,
  redactUrlQuery,
} from '../sensitiveHeaders'

// Fake credentials only.
const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'
const REDACTED = '[Redacted]'

describe('sensitiveHeaders', () => {
  describe('header and param names', () => {
    it('recognizes the known credential headers, with or without the account suffix', () => {
      for (const name of ['Authorization', 'cookie', 'Set-Cookie', 'X-Vtex-Api-AppToken', 'VtexIdclientAutCookie_acme']) {
        expect(isKnownCredentialHeaderName(name)).toBe(true)
      }
      expect(isKnownCredentialHeaderName('www-authenticate')).toBe(false)
      expect(isKnownCredentialHeaderName('content-type')).toBe(false)
    })

    it('also treats credential-looking names as sensitive for headers the app sent', () => {
      expect(isSensitiveHeaderName('X-Partner-Api-Key')).toBe(true)
      expect(isSensitiveHeaderName('accept')).toBe(false)
      expect(isSensitiveParamName('appToken')).toBe(true)
      expect(isSensitiveParamName('page')).toBe(false)
    })
  })

  describe('redactUrlQuery', () => {
    it('masks user info, keeping the scheme, host and path', () => {
      expect(redactUrlQuery('https://user:pass@upstream.example/orders')).toBe(`https://${REDACTED}@upstream.example/orders`)
      expect(redactUrlQuery('//user@upstream.example/orders')).toBe(`//${REDACTED}@upstream.example/orders`)
    })

    it('masks credential-named query values, encoded and nested keys included, keeping the rest', () => {
      expect(redactUrlQuery(`/orders?an=acme&appToken=${TOKEN}#top`)).toBe(`/orders?an=acme&appToken=${REDACTED}#top`)
      expect(redactUrlQuery(`/orders?filter%5BapiKey%5D=${TOKEN}&page=2`)).toBe(`/orders?filter%5BapiKey%5D=${REDACTED}&page=2`)
    })

    it('returns the same value when there is nothing to mask, and non-strings as they are', () => {
      const url = '/orders?page=2'

      expect(redactUrlQuery(url)).toBe(url)
      expect(redactUrlQuery('/orders')).toBe('/orders')
      expect(redactUrlQuery(undefined)).toBeUndefined()
    })

    it('masks user info in the other forms the URL parser accepts', () => {
      expect(redactUrlQuery('http:/user:pw@host/p')).toBe(`http:/${REDACTED}@host/p`)
      expect(redactUrlQuery('http:\\\\user:pw@host/p')).toBe(`http:\\\\${REDACTED}@host/p`)
      expect(redactUrlQuery('  https://user:pw@host/p')).toBe(`  https://${REDACTED}@host/p`)
      expect(redactUrlQuery('http:user:pw@host/p')).toBe(`http:${REDACTED}@host/p`)
    })

    it('replaces the whole URL when the parser still finds user info the pattern missed', () => {
      expect(redactUrlQuery('ht\ttp://user:pw@host/p')).toBe(REDACTED)
    })

    it('does not treat an @ in the path, or in a scheme without authority, as user info', () => {
      expect(redactUrlQuery('/users/someone@example.com')).toBe('/users/someone@example.com')
      expect(redactUrlQuery('https://host/p@x')).toBe('https://host/p@x')
      expect(redactUrlQuery('mailto:someone@example.com')).toBe('mailto:someone@example.com')
    })
  })

  describe('redactCredentialFields', () => {
    it('masks credential-named keys at any depth, with copy-on-write', () => {
      const untouched = { status: 'open' }
      const value = { filter: { apiKey: TOKEN }, list: [{ secret: TOKEN }], untouched }

      const result: any = redactCredentialFields(value)

      expect(result).toEqual({ filter: { apiKey: REDACTED }, list: [{ secret: REDACTED }], untouched })
      expect(result.untouched).toBe(untouched)
      expect(value.filter.apiKey).toBe(TOKEN)
    })

    it('inspects what a value with its own toJSON serializes to', () => {
      const value = { filter: { apiKey: TOKEN, toJSON: () => ({ apiKey: TOKEN, status: 'open' }) }, when: new Date(0) }

      const result: any = redactCredentialFields(value)

      expect(result).toEqual({ filter: { apiKey: REDACTED, status: 'open' }, when: '1970-01-01T00:00:00.000Z' })
      expect(JSON.stringify(result)).not.toContain(TOKEN)
    })

    it('returns buffers and streams as they are', () => {
      const buffer = Buffer.from('appToken')
      const stream = { pipe: () => undefined, token: TOKEN }

      expect(redactCredentialFields(buffer)).toBe(buffer)
      expect(redactCredentialFields(stream)).toBe(stream)
    })
  })

  describe('redactRequestData', () => {
    it('masks credential-named keys of a JSON body, keeping the text when there is nothing to mask', () => {
      expect(redactRequestData(JSON.stringify({ apiKey: TOKEN, name: 'catalog' }))).toBe(JSON.stringify({ apiKey: REDACTED, name: 'catalog' }))
      const clean = '{"name":"catalog"}'
      expect(redactRequestData(clean)).toBe(clean)
    })

    it('masks credential-named values of a form body', () => {
      expect(redactRequestData(`client_secret=${TOKEN}&grant_type=client_credentials&name=a+b`))
        .toBe(`client_secret=${REDACTED}&grant_type=client_credentials&name=a+b`)
    })

    it('keeps other text as it is', () => {
      expect(redactRequestData(`plain text with token=${TOKEN}`)).toBe(`plain text with token=${TOKEN}`)
      expect(redactRequestData('{not json')).toBe('{not json')
    })
  })
})
