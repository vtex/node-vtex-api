import {
  NODE_VTEX_API_VERSION,
  DEFAULT_WORKSPACE,
  IS_IO,
  PID,
  HeaderKeys,
  AttributeKeys,
  BODY_HASH,
  UP_SIGNAL,
  MAX_AGE,
  HTTP_SERVER_PORT,
  MAX_WORKERS,
  LINKED,
  REGION,
  PUBLIC_ENDPOINT,
  APP,
  NODE_ENV,
  ACCOUNT,
  WORKSPACE,
  PRODUCTION,
  INSPECT_DEBUGGER_PORT,
  cancellableMethods,
  LOG_CLIENT_INIT_TIMEOUT_MS,
  // Backward-compatible individual header constants
  CACHE_CONTROL_HEADER,
  SEGMENT_HEADER,
  SESSION_HEADER,
  PRODUCT_HEADER,
  LOCALE_HEADER,
  FORWARDED_HOST_HEADER,
  TENANT_HEADER,
  BINDING_HEADER,
  META_HEADER,
  META_HEADER_BUCKET,
  ETAG_HEADER,
  ACCOUNT_HEADER,
  CREDENTIAL_HEADER,
  REQUEST_ID_HEADER,
  ROUTER_CACHE_HEADER,
  OPERATION_ID_HEADER,
  PLATFORM_HEADER,
  WORKSPACE_IS_PRODUCTION_HEADER,
  WORKSPACE_HEADER,
  EVENT_KEY_HEADER,
  EVENT_SENDER_HEADER,
  EVENT_SUBJECT_HEADER,
  EVENT_HANDLER_ID_HEADER,
  COLOSSUS_ROUTE_DECLARER_HEADER,
  COLOSSUS_ROUTE_ID_HEADER,
  COLOSSUS_PARAMS_HEADER,
  TRACE_ID_HEADER,
  PROVIDER_HEADER
} from './constants'

describe('constants', () => {
  describe('Basic constants', () => {
    test('NODE_VTEX_API_VERSION should match package.json version', () => {
      const pkg = require('../package.json')
      expect(NODE_VTEX_API_VERSION).toBe(pkg.version)
      expect(typeof NODE_VTEX_API_VERSION).toBe('string')
      expect(NODE_VTEX_API_VERSION.length).toBeGreaterThan(0)
    })

    test('DEFAULT_WORKSPACE should be a non-empty string', () => {
      expect(typeof DEFAULT_WORKSPACE).toBe('string')
      expect(DEFAULT_WORKSPACE.length).toBeGreaterThan(0)
    })

    test('IS_IO should reflect VTEX_IO environment variable', () => {
      expect(IS_IO).toBe(process.env.VTEX_IO)
    })

    test('PID should be the current process ID', () => {
      expect(PID).toBe(process.pid)
      expect(typeof PID).toBe('number')
      expect(PID).toBeGreaterThan(0)
    })
  })

  describe('HeaderKeys', () => {
    test('should be an object with string properties', () => {
      expect(typeof HeaderKeys).toBe('object')
      expect(HeaderKeys).not.toBeNull()
    })

    test('all header keys should be uppercase with underscores', () => {
      Object.keys(HeaderKeys).forEach(key => {
        expect(key).toMatch(/^[A-Z_]+$/)
      })
    })

    test('VTEX headers should follow x-vtex- or x- naming pattern', () => {
      const vtexSpecificHeaders = Object.entries(HeaderKeys).filter(([key]) =>
        key.includes('VTEX') ||
        key === 'ACCOUNT' ||
        key === 'WORKSPACE' ||
        key === 'OPERATION_ID' ||
        key === 'SEGMENT'
      )

      vtexSpecificHeaders.forEach(([, value]) => {
        expect(value).toMatch(/^x-/)
      })
    })

    test('should not contain empty or invalid header values', () => {
      Object.values(HeaderKeys).forEach(value => {
        expect(value).not.toContain(' ')
        expect(value).not.toMatch(/[A-Z]/)
        expect(value).not.toContain('\n')
        expect(value).not.toContain('\r')
      })
    })
  })

  describe('AttributeKeys', () => {
    test('should be an object with string properties', () => {
      expect(typeof AttributeKeys).toBe('object')
      expect(AttributeKeys).not.toBeNull()
    })

    test('should contain VTEX semantic attributes', () => {
      expect(AttributeKeys).toHaveProperty('VTEX_ACCOUNT_NAME')

      expect(typeof AttributeKeys.VTEX_ACCOUNT_NAME).toBe('string')
    })

    test('should contain VTEX IO semantic attributes', () => {
      expect(AttributeKeys).toHaveProperty('VTEX_IO_WORKSPACE_NAME')
      expect(AttributeKeys).toHaveProperty('VTEX_IO_WORKSPACE_TYPE')
      expect(AttributeKeys).toHaveProperty('VTEX_IO_APP_ID')
      expect(AttributeKeys).toHaveProperty('VTEX_IO_APP_AUTHOR_TYPE')

      expect(typeof AttributeKeys.VTEX_IO_WORKSPACE_NAME).toBe('string')
      expect(typeof AttributeKeys.VTEX_IO_WORKSPACE_TYPE).toBe('string')
      expect(typeof AttributeKeys.VTEX_IO_APP_ID).toBe('string')
      expect(typeof AttributeKeys.VTEX_IO_APP_AUTHOR_TYPE).toBe('string')
    })

    test('should have non-empty string values', () => {
      Object.values(AttributeKeys).forEach((value: any) => {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
      })
    })

    test('attribute names should follow naming convention', () => {
      Object.keys(AttributeKeys).forEach(key => {
        expect(key).toMatch(/^VTEX(_IO)?_[A-Z_]+$/)
      })
    })

    test('should import from external module without errors', () => {
      // Test that the AttributeKeys structure exists and is properly imported
      expect(AttributeKeys).toBeDefined()
      Object.values(AttributeKeys).forEach(value => {
        expect(value).toBeTruthy()
      })
    })
  })

  describe('Cache constants', () => {
    test('MAX_AGE should be an object with numeric properties', () => {
      expect(typeof MAX_AGE).toBe('object')
      expect(MAX_AGE).not.toBeNull()
    })

    test('MAX_AGE should contain LONG, MEDIUM, SHORT properties', () => {
      expect(MAX_AGE).toHaveProperty('LONG')
      expect(MAX_AGE).toHaveProperty('MEDIUM')
      expect(MAX_AGE).toHaveProperty('SHORT')

      expect(typeof MAX_AGE.LONG).toBe('number')
      expect(typeof MAX_AGE.MEDIUM).toBe('number')
      expect(typeof MAX_AGE.SHORT).toBe('number')
    })

    test('MAX_AGE values should be positive integers', () => {
      Object.values(MAX_AGE).forEach(value => {
        expect(value).toBeGreaterThan(0)
        expect(Number.isInteger(value)).toBe(true)
      })
    })

    test('MAX_AGE values should be in logical order', () => {
      expect(MAX_AGE.LONG).toBeGreaterThan(MAX_AGE.MEDIUM)
      expect(MAX_AGE.MEDIUM).toBeGreaterThan(MAX_AGE.SHORT)
    })
  })

  describe('Server configuration', () => {
    test('server ports should have specific expected values', () => {
      expect(HTTP_SERVER_PORT).toBe(5050)
      expect(INSPECT_DEBUGGER_PORT).toBe(5858)

      // Ensure they are numbers
      expect(typeof HTTP_SERVER_PORT).toBe('number')
      expect(typeof INSPECT_DEBUGGER_PORT).toBe('number')
    })

    test('MAX_WORKERS should be a positive integer', () => {
      expect(typeof MAX_WORKERS).toBe('number')
      expect(MAX_WORKERS).toBeGreaterThan(0)
      expect(Number.isInteger(MAX_WORKERS)).toBe(true)
    })

    test('LOG_CLIENT_INIT_TIMEOUT_MS should be a positive number', () => {
      expect(typeof LOG_CLIENT_INIT_TIMEOUT_MS).toBe('number')
      expect(LOG_CLIENT_INIT_TIMEOUT_MS).toBeGreaterThan(0)
    })
  })

  describe('Environment-based constants', () => {
    test('boolean environment constants should have correct types', () => {
      expect(typeof LINKED).toBe('boolean')
      expect(typeof PRODUCTION).toBe('boolean')
    })

    test('string environment constants should match their env vars', () => {
      expect(REGION).toBe(process.env.VTEX_REGION as string)
      expect(NODE_ENV).toBe(process.env.NODE_ENV as string)
      expect(ACCOUNT).toBe(process.env.VTEX_ACCOUNT as string)
      expect(WORKSPACE).toBe(process.env.VTEX_WORKSPACE as string)
    })

    test('PUBLIC_ENDPOINT should have a fallback value', () => {
      expect(typeof PUBLIC_ENDPOINT).toBe('string')
      expect(PUBLIC_ENDPOINT.length).toBeGreaterThan(0)
    })

    test('LINKED should reflect boolean conversion of VTEX_APP_LINK', () => {
      expect(LINKED).toBe(!!process.env.VTEX_APP_LINK)
    })

    test('PRODUCTION should reflect string comparison', () => {
      expect(PRODUCTION).toBe(process.env.VTEX_PRODUCTION === 'true')
    })
  })

  describe('APP object', () => {
    test('should be an object with required properties', () => {
      expect(typeof APP).toBe('object')
      expect(APP).not.toBeNull()

      const requiredProperties = ['ID', 'MAJOR', 'NAME', 'VENDOR', 'VERSION', 'IS_THIRD_PARTY']
      requiredProperties.forEach(prop => {
        expect(APP).toHaveProperty(prop)
      })
    })

    test('string properties should match environment variables', () => {
      expect(APP.ID).toBe(process.env.VTEX_APP_ID as string)
      expect(APP.NAME).toBe(process.env.VTEX_APP_NAME as string)
      expect(APP.VENDOR).toBe(process.env.VTEX_APP_VENDOR as string)
      expect(APP.VERSION).toBe(process.env.VTEX_APP_VERSION as string)
    })

    test('MAJOR should be extracted from VERSION', () => {
      if (process.env.VTEX_APP_VERSION) {
        expect(typeof APP.MAJOR).toBe('string')
      } else {
        expect(APP.MAJOR).toBe('')
      }
    })

    test('IS_THIRD_PARTY should be a function', () => {
      expect(typeof APP.IS_THIRD_PARTY).toBe('function')
    })

    test('IS_THIRD_PARTY should return boolean', () => {
      const result = APP.IS_THIRD_PARTY()
      expect(typeof result).toBe('boolean')
    })

    test('IS_THIRD_PARTY logic should work correctly', () => {
      // Test the logic with different vendor values
      const testCases = [
        { vendor: 'vtex', expected: false },
        { vendor: 'gocommerce', expected: false },
        { vendor: 'other', expected: true },
        { vendor: undefined, expected: true }
      ]

      testCases.forEach(({ vendor, expected }) => {
        const mockApp = {
          VENDOR: vendor,
          IS_THIRD_PARTY() {
            return 'vtex' !== this.VENDOR && 'gocommerce' !== this.VENDOR
          }
        }
        expect(mockApp.IS_THIRD_PARTY()).toBe(expected)
      })
    })
  })

  describe('HTTP methods', () => {
    test('cancellableMethods should be a Set', () => {
      expect(cancellableMethods).toBeInstanceOf(Set)
    })

    test('cancellableMethods should contain safe HTTP methods', () => {
      expect(cancellableMethods.has('GET')).toBe(true)
      expect(cancellableMethods.has('OPTIONS')).toBe(true)
      expect(cancellableMethods.has('HEAD')).toBe(true)
    })

    test('cancellableMethods should not contain unsafe HTTP methods', () => {
      const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH']
      unsafeMethods.forEach(method => {
        expect(cancellableMethods.has(method)).toBe(false)
      })
    })

    test('cancellableMethods should have appropriate size', () => {
      expect(cancellableMethods.size).toBeGreaterThan(0)
      expect(cancellableMethods.size).toBeLessThan(10) // Reasonable upper bound
    })

    test('all methods in cancellableMethods should be strings', () => {
      cancellableMethods.forEach((method: any) => {
        expect(typeof method).toBe('string')
        expect(method.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Integration and dependencies', () => {
    test('should import required modules without errors', () => {
      expect(() => {
        require('./utils/app')
      }).not.toThrow()
    })

    test('package.json should be accessible and valid', () => {
      const pkg = require('../package.json')
      expect(pkg).toHaveProperty('name')
      expect(pkg).toHaveProperty('version')
      expect(typeof pkg.name).toBe('string')
      expect(typeof pkg.version).toBe('string')
    })

    test('should handle external module imports gracefully', () => {
      // Test that AttributeKeys exists even if external module has issues
      expect(AttributeKeys).toBeDefined()
      expect(typeof AttributeKeys).toBe('object')
    })
  })

  describe('Constants structure and exports', () => {
    test('should export all required constants', () => {
      // Test that all expected exports are defined using direct references
      const constants = {
        NODE_VTEX_API_VERSION,
        DEFAULT_WORKSPACE,
        IS_IO,
        PID,
        HeaderKeys,
        AttributeKeys,
        BODY_HASH,
        UP_SIGNAL,
        MAX_AGE,
        HTTP_SERVER_PORT,
        MAX_WORKERS,
        LINKED,
        REGION,
        PUBLIC_ENDPOINT,
        APP,
        NODE_ENV,
        ACCOUNT,
        WORKSPACE,
        PRODUCTION,
        INSPECT_DEBUGGER_PORT,
        cancellableMethods,
        LOG_CLIENT_INIT_TIMEOUT_MS
      }

      // Environment-based constants that can be undefined in test environment
      const envBasedConstants = ['IS_IO', 'REGION', 'ACCOUNT', 'WORKSPACE', 'NODE_ENV']

      Object.entries(constants).forEach(([name, value]) => {
        if (envBasedConstants.includes(name)) {
          // Environment-based constants can be undefined, but should not be null
          expect(value).not.toBeNull()
        } else {
          // Other constants should be defined
          expect(value).toBeDefined()
          expect(value).not.toBeNull()
        }
      })
    })

    test('constants should have consistent types', () => {
      // Test type consistency
      expect(typeof NODE_VTEX_API_VERSION).toBe('string')
      expect(typeof DEFAULT_WORKSPACE).toBe('string')
      expect(typeof PID).toBe('number')
      expect(typeof HeaderKeys).toBe('object')
      expect(typeof AttributeKeys).toBe('object')
      expect(typeof BODY_HASH).toBe('string')
      expect(typeof UP_SIGNAL).toBe('string')
      expect(typeof MAX_AGE).toBe('object')
      expect(typeof HTTP_SERVER_PORT).toBe('number')
      expect(typeof MAX_WORKERS).toBe('number')
      expect(typeof LINKED).toBe('boolean')
      expect(typeof PUBLIC_ENDPOINT).toBe('string')
      expect(typeof APP).toBe('object')
      expect(typeof PRODUCTION).toBe('boolean')
      expect(typeof INSPECT_DEBUGGER_PORT).toBe('number')
      expect(cancellableMethods).toBeInstanceOf(Set)
      expect(typeof LOG_CLIENT_INIT_TIMEOUT_MS).toBe('number')
    })

    test('should not have null or undefined critical constants', () => {
      expect(NODE_VTEX_API_VERSION).not.toBeNull()
      expect(DEFAULT_WORKSPACE).not.toBeNull()
      expect(PID).not.toBeNull()
      expect(HeaderKeys).not.toBeNull()
      expect(AttributeKeys).not.toBeNull()
      expect(BODY_HASH).not.toBeNull()
      expect(UP_SIGNAL).not.toBeNull()
      expect(MAX_AGE).not.toBeNull()
      expect(APP).not.toBeNull()
      expect(cancellableMethods).not.toBeNull()
    })
  })

  describe('Backward compatibility', () => {
    test('should maintain critical header structure', () => {
      // Test that critical headers exist without testing specific values
      const criticalHeaders = ['ACCOUNT', 'WORKSPACE', 'OPERATION_ID', 'REQUEST_ID', 'TRACE_ID']

      criticalHeaders.forEach(header => {
        expect(HeaderKeys).toHaveProperty(header)
        expect(typeof HeaderKeys[header as keyof typeof HeaderKeys]).toBe('string')
      })
    })

    test('should maintain AttributeKeys structure', () => {
      const requiredAttributes = [
        'VTEX_ACCOUNT_NAME',
        'VTEX_IO_WORKSPACE_NAME', 'VTEX_IO_WORKSPACE_TYPE',
        'VTEX_IO_APP_ID', 'VTEX_IO_APP_AUTHOR_TYPE'
      ]

      requiredAttributes.forEach(attr => {
        expect(AttributeKeys).toHaveProperty(attr)
        expect(typeof AttributeKeys[attr as keyof typeof AttributeKeys]).toBe('string')
      })
    })

    test('should maintain APP object structure', () => {
      const requiredProperties = ['ID', 'MAJOR', 'NAME', 'VENDOR', 'VERSION', 'IS_THIRD_PARTY']

      requiredProperties.forEach(prop => {
        expect(APP).toHaveProperty(prop)
      })
    })

    describe('Individual header constants (deprecated)', () => {
      test('all individual header constants should be defined', () => {
        expect(CACHE_CONTROL_HEADER).toBeDefined()
        expect(SEGMENT_HEADER).toBeDefined()
        expect(SESSION_HEADER).toBeDefined()
        expect(PRODUCT_HEADER).toBeDefined()
        expect(LOCALE_HEADER).toBeDefined()
        expect(FORWARDED_HOST_HEADER).toBeDefined()
        expect(TENANT_HEADER).toBeDefined()
        expect(BINDING_HEADER).toBeDefined()
        expect(META_HEADER).toBeDefined()
        expect(META_HEADER_BUCKET).toBeDefined()
        expect(ETAG_HEADER).toBeDefined()
        expect(ACCOUNT_HEADER).toBeDefined()
        expect(CREDENTIAL_HEADER).toBeDefined()
        expect(REQUEST_ID_HEADER).toBeDefined()
        expect(ROUTER_CACHE_HEADER).toBeDefined()
        expect(OPERATION_ID_HEADER).toBeDefined()
        expect(PLATFORM_HEADER).toBeDefined()
        expect(WORKSPACE_IS_PRODUCTION_HEADER).toBeDefined()
        expect(WORKSPACE_HEADER).toBeDefined()
        expect(EVENT_KEY_HEADER).toBeDefined()
        expect(EVENT_SENDER_HEADER).toBeDefined()
        expect(EVENT_SUBJECT_HEADER).toBeDefined()
        expect(EVENT_HANDLER_ID_HEADER).toBeDefined()
        expect(COLOSSUS_ROUTE_DECLARER_HEADER).toBeDefined()
        expect(COLOSSUS_ROUTE_ID_HEADER).toBeDefined()
        expect(COLOSSUS_PARAMS_HEADER).toBeDefined()
        expect(TRACE_ID_HEADER).toBeDefined()
        expect(PROVIDER_HEADER).toBeDefined()
      })

      test('individual constants should equal HeaderKeys values', () => {
        expect(CACHE_CONTROL_HEADER).toBe(HeaderKeys.CACHE_CONTROL)
        expect(SEGMENT_HEADER).toBe(HeaderKeys.SEGMENT)
        expect(SESSION_HEADER).toBe(HeaderKeys.SESSION)
        expect(PRODUCT_HEADER).toBe(HeaderKeys.PRODUCT)
        expect(LOCALE_HEADER).toBe(HeaderKeys.LOCALE)
        expect(FORWARDED_HOST_HEADER).toBe(HeaderKeys.FORWARDED_HOST)
        expect(TENANT_HEADER).toBe(HeaderKeys.TENANT)
        expect(BINDING_HEADER).toBe(HeaderKeys.BINDING)
        expect(META_HEADER).toBe(HeaderKeys.META)
        expect(META_HEADER_BUCKET).toBe(HeaderKeys.META_BUCKET)
        expect(ETAG_HEADER).toBe(HeaderKeys.ETAG)
        expect(ACCOUNT_HEADER).toBe(HeaderKeys.ACCOUNT)
        expect(CREDENTIAL_HEADER).toBe(HeaderKeys.CREDENTIAL)
        expect(REQUEST_ID_HEADER).toBe(HeaderKeys.REQUEST_ID)
        expect(ROUTER_CACHE_HEADER).toBe(HeaderKeys.ROUTER_CACHE)
        expect(OPERATION_ID_HEADER).toBe(HeaderKeys.OPERATION_ID)
        expect(PLATFORM_HEADER).toBe(HeaderKeys.PLATFORM)
        expect(WORKSPACE_IS_PRODUCTION_HEADER).toBe(HeaderKeys.WORKSPACE_IS_PRODUCTION)
        expect(WORKSPACE_HEADER).toBe(HeaderKeys.WORKSPACE)
        expect(EVENT_KEY_HEADER).toBe(HeaderKeys.EVENT_KEY)
        expect(EVENT_SENDER_HEADER).toBe(HeaderKeys.EVENT_SENDER)
        expect(EVENT_SUBJECT_HEADER).toBe(HeaderKeys.EVENT_SUBJECT)
        expect(EVENT_HANDLER_ID_HEADER).toBe(HeaderKeys.EVENT_HANDLER_ID)
        expect(COLOSSUS_ROUTE_DECLARER_HEADER).toBe(HeaderKeys.COLOSSUS_ROUTE_DECLARER)
        expect(COLOSSUS_ROUTE_ID_HEADER).toBe(HeaderKeys.COLOSSUS_ROUTE_ID)
        expect(COLOSSUS_PARAMS_HEADER).toBe(HeaderKeys.COLOSSUS_PARAMS)
        expect(TRACE_ID_HEADER).toBe(HeaderKeys.TRACE_ID)
        expect(PROVIDER_HEADER).toBe(HeaderKeys.PROVIDER)
      })

      test('critical individual constants should have expected string values', () => {
        expect(TENANT_HEADER).toBe('x-vtex-tenant')
        expect(BINDING_HEADER).toBe('x-vtex-binding')
        expect(LOCALE_HEADER).toBe('x-vtex-locale')
        expect(SEGMENT_HEADER).toBe('x-vtex-segment')
        expect(SESSION_HEADER).toBe('x-vtex-session')
        expect(ACCOUNT_HEADER).toBe('x-vtex-account')
        expect(WORKSPACE_HEADER).toBe('x-vtex-workspace')
      })

      test('individual constants should be strings', () => {
        expect(typeof TENANT_HEADER).toBe('string')
        expect(typeof BINDING_HEADER).toBe('string')
        expect(typeof LOCALE_HEADER).toBe('string')
        expect(typeof SEGMENT_HEADER).toBe('string')
      })

      test('constants can be used as object keys without runtime errors', () => {
        // This is how IO apps use them in practice
        const headers = {
          [TENANT_HEADER]: 'example-value',
          [BINDING_HEADER]: 'example-binding',
          [LOCALE_HEADER]: 'en-US',
          [SEGMENT_HEADER]: 'segment-token',
          [SESSION_HEADER]: 'session-token',
          [ACCOUNT_HEADER]: 'account-name',
          [WORKSPACE_HEADER]: 'master'
        }

        expect(headers['x-vtex-tenant']).toBe('example-value')
        expect(headers['x-vtex-binding']).toBe('example-binding')
        expect(headers['x-vtex-locale']).toBe('en-US')
        expect(headers['x-vtex-segment']).toBe('segment-token')
        expect(Object.keys(headers)).toHaveLength(7)
        
        // Verify no undefined keys were created
        Object.keys(headers).forEach(key => {
          expect(key).not.toBe('undefined')
          expect(headers[key]).toBeDefined()
        })
      })

      test('constants can be destructured from module exports', () => {
        // Simulates: import { TENANT_HEADER, BINDING_HEADER } from '@vtex/api'
        const constants = require('./constants')
        const {
          TENANT_HEADER: tenant,
          BINDING_HEADER: binding,
          LOCALE_HEADER: locale,
          SEGMENT_HEADER: segment
        } = constants

        expect(tenant).toBeDefined()
        expect(binding).toBeDefined()
        expect(locale).toBeDefined()
        expect(segment).toBeDefined()

        expect(tenant).toBe('x-vtex-tenant')
        expect(binding).toBe('x-vtex-binding')
        expect(locale).toBe('x-vtex-locale')
        expect(segment).toBe('x-vtex-segment')

        // Ensure they're not undefined
        expect(tenant).not.toBe(undefined)
        expect(binding).not.toBe(undefined)
      })

      test('individual constants are compatible with VaryHeaders type', () => {
        // VaryHeaders type uses HeaderKeys internally, but should accept old constants
        const varyHeaderValues: string[] = [SEGMENT_HEADER, SESSION_HEADER, PRODUCT_HEADER, LOCALE_HEADER]

        varyHeaderValues.forEach(header => {
          expect(typeof header).toBe('string')
          expect(header.length).toBeGreaterThan(0)
          // VTEX headers follow x-vtex- pattern, except standard headers like cache-control
          expect(header).toMatch(/^x-vtex-|^cache-control$|^etag$/)
        })

        // Verify they match the type definition (HeaderKeys values)
        const expectedVaryHeaders = [
          HeaderKeys.SEGMENT,
          HeaderKeys.SESSION,
          HeaderKeys.PRODUCT,
          HeaderKeys.LOCALE
        ]

        expect(varyHeaderValues).toEqual(expectedVaryHeaders)

        // Ensure VaryHeaders type inference works
        expect(SEGMENT_HEADER).toBe(HeaderKeys.SEGMENT)
        expect(SESSION_HEADER).toBe(HeaderKeys.SESSION)
        expect(PRODUCT_HEADER).toBe(HeaderKeys.PRODUCT)
        expect(LOCALE_HEADER).toBe(HeaderKeys.LOCALE)
      })

      test('constants work correctly as header keys in realistic scenarios', () => {
        // Simulates IO apps usage patterns
        const mockBinding = { locale: 'en-US', currency: 'USD' }
        const mockTenant = { locale: 'pt-BR' }
        const mockSegmentToken = 'eyJjYW1wYWlnbnMiOm51bGx9'
        const mockSessionToken = 'session-abc-123'

        // Pattern 1: Building headers object
        const requestHeaders = {
          [BINDING_HEADER]: JSON.stringify(mockBinding),
          [TENANT_HEADER]: mockTenant.locale,
          [LOCALE_HEADER]: 'en-US',
          [SEGMENT_HEADER]: mockSegmentToken,
          [SESSION_HEADER]: mockSessionToken,
          [ACCOUNT_HEADER]: 'vtexstore',
          [WORKSPACE_HEADER]: 'master'
        }

        expect(requestHeaders['x-vtex-binding']).toBe(JSON.stringify(mockBinding))
        expect(requestHeaders['x-vtex-tenant']).toBe('pt-BR')
        expect(requestHeaders['x-vtex-locale']).toBe('en-US')
        expect(requestHeaders['x-vtex-segment']).toBe(mockSegmentToken)
        expect(requestHeaders['x-vtex-session']).toBe(mockSessionToken)

        // Pattern 2: Conditional header setting
        const conditionalHeaders: Record<string, string> = {}
        if (mockSegmentToken) {
          conditionalHeaders[SEGMENT_HEADER] = mockSegmentToken
        }
        if (mockSessionToken) {
          conditionalHeaders[SESSION_HEADER] = mockSessionToken
        }

        expect(conditionalHeaders['x-vtex-segment']).toBe(mockSegmentToken)
        expect(conditionalHeaders['x-vtex-session']).toBe(mockSessionToken)
        expect(Object.keys(conditionalHeaders)).toHaveLength(2)

        // Pattern 3: Reading from headers object
        const incomingHeaders: Record<string, string> = {
          'x-vtex-tenant': 'es-AR',
          'x-vtex-binding': '{"locale":"es-AR"}',
          'x-vtex-account': 'mystore'
        }

        expect(incomingHeaders[TENANT_HEADER]).toBe('es-AR')
        expect(incomingHeaders[BINDING_HEADER]).toBe('{"locale":"es-AR"}')
        expect(incomingHeaders[ACCOUNT_HEADER]).toBe('mystore')

        // Verify no undefined keys in any pattern
        expect(TENANT_HEADER).not.toBe('undefined')
        expect(BINDING_HEADER).not.toBe('undefined')
        expect(SEGMENT_HEADER).not.toBe('undefined')
      })
    })
  })
})
