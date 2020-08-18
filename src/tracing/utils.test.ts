import { cloneAndSanitizeHeaders } from './utils'
import { SENSITIVE_STR } from '@vtex/node-error-report'

describe('cloneAndSanitizeHeaders', () => {
  const headers = {
    authorization: '1337',
    a: 'b',
  }

  test('Original object is not modified', () => {
    cloneAndSanitizeHeaders(headers)
    expect(headers).toEqual({
      authorization: '1337',
      a: 'b',
    })
  })

  test('Sensitive information is redacted', () => {
    expect(cloneAndSanitizeHeaders(headers)).toEqual({
      authorization: SENSITIVE_STR,
      a: 'b',
    })
  })

  test('Prefix is added if specified', () => {
    expect(cloneAndSanitizeHeaders(headers, 'test.')).toEqual({
      'test.authorization': SENSITIVE_STR,
      'test.a': 'b',
    })
  })

  test('It works if the header is an axios header object', () => {
    const axiosHeader = {
      common: {
        Accept: 'application/json, text/plain, */*',
      },
      delete: {},
      get: {},
      head: {},
      post: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      ...headers,
    }

    expect(cloneAndSanitizeHeaders(axiosHeader)).toEqual({
      common: {
        Accept: 'application/json, text/plain, */*',
      },
      delete: {},
      get: {},
      head: {},
      post: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      authorization: SENSITIVE_STR,
      a: 'b',
    })
  })
})
