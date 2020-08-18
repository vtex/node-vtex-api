import { SENSITIVE_STR } from '@vtex/node-error-report'
import { cloneAndSanitizeHeaders } from './utils'

describe('cloneAndSanitizeHeaders', () => {
  const headers = {
    a: 'b',
    authorization: '1337',
  }

  test('Original object is not modified', () => {
    cloneAndSanitizeHeaders(headers)
    expect(headers).toEqual({
      a: 'b',
      authorization: '1337',
    })
  })

  test('Sensitive information is redacted', () => {
    expect(cloneAndSanitizeHeaders(headers)).toEqual({
      a: 'b',
      authorization: SENSITIVE_STR,
    })
  })

  test('Prefix is added if specified', () => {
    expect(cloneAndSanitizeHeaders(headers, 'test.')).toEqual({
      'test.a': 'b',
      'test.authorization': SENSITIVE_STR,
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
      a: 'b',
      authorization: SENSITIVE_STR,
      common: {
        Accept: 'application/json, text/plain, */*',
      },
      delete: {},
      get: {},
      head: {},
      post: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  })
})
