import { authFields, sanitizeAuth } from '@vtex/node-error-report'
import { cloneAndSanitizeHeaders, INTERESTING_HEADERS } from './utils'

describe('cloneAndSanitizeHeaders', () => {
  const headers = {
    'content-type': 'application/json',
    'authorization': 'Bearer secret-token',
    'x-request-id': '12345',
    'x-vtex-custom': 'vtex-value',
    'random-header': 'should-be-filtered',
    'cookie': 'sessionId=abc123',
  }

  test('Original object is not modified', () => {
    const originalHeaders = { ...headers }
    cloneAndSanitizeHeaders(headers)
    expect(headers).toEqual(originalHeaders)
  })

  test('Only includes whitelisted headers and x-vtex-* headers', () => {
    const result = cloneAndSanitizeHeaders(headers)

    // Should include whitelisted headers
    expect(result).toHaveProperty('content-type', 'application/json')
    expect(result).toHaveProperty('x-request-id', '12345')

    // Should include x-vtex-* headers
    expect(result).toHaveProperty('x-vtex-custom', 'vtex-value')

    // Should NOT include non-whitelisted headers
    expect(result).not.toHaveProperty('random-header')
  })

  test('Sensitive information is sanitized using authFields', () => {
    const result = cloneAndSanitizeHeaders(headers)

    // Check if authorization is sanitized (if it's in authFields)
    if (authFields.includes('authorization')) {
      expect(result.authorization).toBe(sanitizeAuth('Bearer secret-token'))
    }

    // Check if cookie is sanitized (if it's in authFields)
    if (authFields.includes('cookie')) {
      expect(result.cookie).toBe(sanitizeAuth('sessionId=abc123'))
    }
  })

  test('Prefix is added if specified', () => {
    const testHeaders = {
      'content-type': 'application/json',
      'x-vtex-test': 'value',
    }

    const result = cloneAndSanitizeHeaders(testHeaders, 'req.')

    expect(result).toEqual({
      'req.content-type': 'application/json',
      'req.x-vtex-test': 'value',
    })
  })

  test('Handles case-insensitive header matching', () => {
    const mixedCaseHeaders = {
      'Content-Type': 'application/json',
      'X-REQUEST-ID': '67890',
      'X-VTEX-Store': 'mystore',
      'AUTHORIZATION': 'Bearer token',
    }

    const result = cloneAndSanitizeHeaders(mixedCaseHeaders)
    
    // Should include headers regardless of case
    expect(result).toHaveProperty('Content-Type', 'application/json')
    expect(result).toHaveProperty('X-REQUEST-ID', '67890')
    expect(result).toHaveProperty('X-VTEX-Store', 'mystore')
    expect(result).toHaveProperty('AUTHORIZATION')
  })

  test('Handles empty headers object', () => {
    const result = cloneAndSanitizeHeaders({})
    expect(result).toEqual({})
  })

  test('Handles axios header object structure', () => {
    const axiosHeaders = {
      common: {
        Accept: 'application/json, text/plain, */*',
      },
      delete: {},
      get: {},
      head: {},
      post: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      'authorization': 'Bearer token',
      'x-vtex-account': 'testaccount',
      'user-agent': 'axios/1.0.0',
    }

    const result = cloneAndSanitizeHeaders(axiosHeaders)

    // Should include whitelisted simple headers
    expect(result).toHaveProperty('user-agent', 'axios/1.0.0')
    expect(result).toHaveProperty('x-vtex-account', 'testaccount')

    // Should include authorization (will be sanitized if in authFields)
    expect(result).toHaveProperty('authorization')

    // Should NOT include axios config objects since they're not whitelisted
    expect(result).not.toHaveProperty('common')
    expect(result).not.toHaveProperty('delete')
    expect(result).not.toHaveProperty('get')
    expect(result).not.toHaveProperty('head')
    expect(result).not.toHaveProperty('post')
  })

  test('Filters out non-whitelisted headers completely', () => {
    const headersWithNoise = {
      'content-type': 'application/json',  // whitelisted
      'x-vtex-store': 'mystore',          // x-vtex-* allowed
      'x-custom-header': 'custom',        // not whitelisted, not x-vtex-*
      'server': 'nginx',                  // not whitelisted
      'x-powered-by': 'Express',          // not whitelisted
      'host': 'api.vtex.com',             // whitelisted
    }

    const result = cloneAndSanitizeHeaders(headersWithNoise)

    expect(Object.keys(result)).toEqual(['content-type', 'x-vtex-store', 'host'])
    expect(result).not.toHaveProperty('x-custom-header')
    expect(result).not.toHaveProperty('server')
    expect(result).not.toHaveProperty('x-powered-by')
  })

  test('All INTERESTING_HEADERS are properly whitelisted', () => {
    // Create a headers object with all interesting headers
    const allInterestingHeaders: Record<string, string> = {}
    INTERESTING_HEADERS.forEach(header => {
      allInterestingHeaders[header] = `value-for-${header}`
    })

    const result = cloneAndSanitizeHeaders(allInterestingHeaders)

    // All interesting headers should be included
    INTERESTING_HEADERS.forEach(header => {
      expect(result).toHaveProperty(header)
    })

    // Should have exactly the same number of headers
    expect(Object.keys(result)).toHaveLength(INTERESTING_HEADERS.length)
  })
})
