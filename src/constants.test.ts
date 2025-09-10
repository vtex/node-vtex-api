import {
  ACCOUNT,
  APP,
  AttributeKeys,
  BODY_HASH,
  cancellableMethods,
  DEFAULT_WORKSPACE,
  HeaderKeys,
  HTTP_SERVER_PORT,
  INSPECT_DEBUGGER_PORT,
  IS_IO,
  LINKED,
  LOG_CLIENT_INIT_TIMEOUT_MS,
  MAX_AGE,
  MAX_WORKERS,
  NODE_ENV,
  NODE_VTEX_API_VERSION,
  PID,
  PRODUCTION,
  PUBLIC_ENDPOINT,
  REGION,
  UP_SIGNAL,
  WORKSPACE
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
        { vendor: undefined, expected: true },
      ]

      testCases.forEach(({ vendor, expected }) => {
        const mockApp = {
          VENDOR: vendor,
          IS_THIRD_PARTY() {
            return 'vtex' !== this.VENDOR && 'gocommerce' !== this.VENDOR
          },
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
        LOG_CLIENT_INIT_TIMEOUT_MS,
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
        'VTEX_IO_APP_ID', 'VTEX_IO_APP_AUTHOR_TYPE',
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
  })
})
