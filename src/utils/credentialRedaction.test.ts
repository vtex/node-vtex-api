import { sanitizeHttpClientError } from '../HttpClient/middlewares/sanitizeHttpClientError'
import { cleanError } from './error'
import { REDACTED } from './stringRedactor'

describe('cleanError', () => {
  it('drops credential headers, the request body and the query string', () => {
    const error = {
      config: {
        data: JSON.stringify({password: 'super-secret-value'}),
        headers: {
          authorization: 'Bearer abcdefghijklmnop',
          'content-type': 'application/json',
        },
        url: 'https://user:pass@host/path?token=abcdefghijklmnop&q=1',
      },
      message: 'failed',
    }

    const cleaned = cleanError(error)

    expect(cleaned.config.headers.authorization).toBeUndefined()
    expect(cleaned.config.headers['content-type']).toBe('application/json')
    expect(cleaned.config.data).toBe(JSON.stringify({password: REDACTED}))
    expect(cleaned.config.url).toBe(`https://${REDACTED}@host/path?token=${REDACTED}&q=1`)
  })
})

describe('sanitizeHttpClientError', () => {
  it('removes the authorization header from the request config', () => {
    const error: any = new Error('Request failed')
    error.config = {
      data: {appKey: 'abcdefghijklmnop'},
      headers: {
        accept: 'application/json',
        authorization: 'Bearer abcdefghijklmnop',
      },
      url: 'https://host/path?appToken=abcdefghijklmnop',
    }
    error.response = {
      config: error.config,
      data: {ok: false},
      headers: {'set-cookie': 'vtexidclientautcookie=abcdefghijklmnop', 'content-type': 'application/json'},
      status: 401,
    }

    sanitizeHttpClientError(error)

    expect(error.config.headers.authorization).toBe(REDACTED)
    expect(error.config.headers.accept).toBe('application/json')
    expect(error.config.data.appKey).toBe(REDACTED)
    expect(error.config.url).toContain(`appToken=${REDACTED}`)
    expect(error.response.headers['set-cookie']).toBe(REDACTED)
    expect(error.response.headers['content-type']).toBe('application/json')
    expect(error.response.status).toBe(401)
  })
})
