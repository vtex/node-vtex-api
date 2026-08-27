import { UNNAMED_REQUEST_HANDLER, requestHandlerLabel } from './requestHandlerLabel'

describe('requestHandlerLabel', () => {
  describe('UNNAMED_REQUEST_HANDLER constant', () => {
    it('should export the constant with value "undefined"', () => {
      // Arrange & Act & Assert
      expect(UNNAMED_REQUEST_HANDLER).toBe('undefined')
    })

    it('should be a non-empty string', () => {
      // Arrange & Act & Assert
      expect(typeof UNNAMED_REQUEST_HANDLER).toBe('string')
      expect(UNNAMED_REQUEST_HANDLER.length).toBeGreaterThan(0)
    })
  })

  describe('requestHandlerLabel function', () => {
    describe('happy path', () => {
      it('should return the provided requestHandlerName when it is a non-empty string', () => {
        // Arrange
        const handlerName = 'getUserById'

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('getUserById')
      })

      it('should return the provided requestHandlerName for various valid handler names', () => {
        // Arrange
        const testCases = [
          'listUsers',
          'createPost',
          'deleteComment',
          'updateProfile',
          'builtin:notFound',
          'builtin:error',
          'middleware:auth'
        ]

        // Act & Assert
        testCases.forEach(handlerName => {
          expect(requestHandlerLabel(handlerName)).toBe(handlerName)
        })
      })

      it('should handle handler names with special characters', () => {
        // Arrange
        const specialNames = [
          'handler-with-dash',
          'handler_with_underscore',
          'handler.with.dot',
          'handler/with/slash',
          'handler:with:colon'
        ]

        // Act & Assert
        specialNames.forEach(name => {
          expect(requestHandlerLabel(name)).toBe(name)
        })
      })

      it('should handle handler names with numbers', () => {
        // Arrange
        const nameWithNumbers = 'handler123'

        // Act
        const result = requestHandlerLabel(nameWithNumbers)

        // Assert
        expect(result).toBe('handler123')
      })
    })

    describe('edge cases - undefined and null', () => {
      it('should return UNNAMED_REQUEST_HANDLER when requestHandlerName is undefined', () => {
        // Arrange
        const handlerName = undefined

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe(UNNAMED_REQUEST_HANDLER)
        expect(result).toBe('undefined')
      })

      it('should return UNNAMED_REQUEST_HANDLER when no argument is provided', () => {
        // Arrange & Act
        const result = requestHandlerLabel()

        // Assert
        expect(result).toBe(UNNAMED_REQUEST_HANDLER)
        expect(result).toBe('undefined')
      })
    })

    describe('edge cases - empty strings', () => {
      it('should return UNNAMED_REQUEST_HANDLER when requestHandlerName is an empty string', () => {
        // Arrange
        const handlerName = ''

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe(UNNAMED_REQUEST_HANDLER)
        expect(result).toBe('undefined')
      })

      it('should fall back for empty string to ensure label is never emitted empty', () => {
        // Arrange
        const emptyHandler = ''

        // Act
        const result = requestHandlerLabel(emptyHandler)

        // Assert
        expect(result).not.toBe('')
        expect(result.length).toBeGreaterThan(0)
      })
    })

    describe('edge cases - whitespace-only strings', () => {
      it('should NOT fall back for whitespace-only strings (they are truthy)', () => {
        // Arrange
        const whitespaceHandler = '   '

        // Act
        const result = requestHandlerLabel(whitespaceHandler)

        // Assert
        expect(result).toBe('   ')
      })

      it('should preserve single space string', () => {
        // Arrange
        const singleSpace = ' '

        // Act
        const result = requestHandlerLabel(singleSpace)

        // Assert
        expect(result).toBe(' ')
      })
    })

    describe('consistency with aggregation expectations', () => {
      it('should return consistent string for undefined across multiple calls', () => {
        // Arrange & Act
        const result1 = requestHandlerLabel(undefined)
        const result2 = requestHandlerLabel()
        const result3 = requestHandlerLabel('')

        // Assert
        expect(result1).toBe(result2)
        expect(result2).toBe(result3)
        expect(result1).toBe('undefined')
      })

      it('should ensure label is never empty string in any scenario', () => {
        // Arrange
        const scenarios = [
          undefined,
          '',
          'validHandler'
        ]

        // Act & Assert
        scenarios.forEach(scenario => {
          const result = requestHandlerLabel(scenario)
          expect(result).not.toBe('')
          expect(result.length).toBeGreaterThan(0)
        })
      })

      it('should preserve historical series identity with "undefined" string', () => {
        // Arrange
        const undefinedHandler = undefined

        // Act
        const result = requestHandlerLabel(undefinedHandler)

        // Assert
        expect(result).toBe('undefined')
        // Verify it matches the constant to ensure prom-client serialization consistency
        expect(result).toBe(UNNAMED_REQUEST_HANDLER)
      })
    })

    describe('type safety', () => {
      it('should return a string in all cases', () => {
        // Arrange
        const testInputs = [undefined, '', 'handler', 'builtin:notFound']

        // Act & Assert
        testInputs.forEach(input => {
          const result = requestHandlerLabel(input)
          expect(typeof result).toBe('string')
        })
      })

      it('should always return UNNAMED_REQUEST_HANDLER or the provided string', () => {
        // Arrange
        const validHandler = 'myHandler'
        const unnamedHandler = undefined

        // Act
        const resultValid = requestHandlerLabel(validHandler)
        const resultUnnamed = requestHandlerLabel(unnamedHandler)

        // Assert
        expect(resultValid === validHandler || resultValid === UNNAMED_REQUEST_HANDLER).toBe(true)
        expect(resultUnnamed === UNNAMED_REQUEST_HANDLER).toBe(true)
      })
    })

    describe('long handler names', () => {
      it('should handle very long handler names', () => {
        // Arrange
        const longName = 'a'.repeat(1000)

        // Act
        const result = requestHandlerLabel(longName)

        // Assert
        expect(result).toBe(longName)
        expect(result.length).toBe(1000)
      })
    })

    describe('numeric and special string inputs', () => {
      it('should handle numeric strings', () => {
        // Arrange
        const numericString = '12345'

        // Act
        const result = requestHandlerLabel(numericString)

        // Assert
        expect(result).toBe('12345')
      })

      it('should handle zero as a string', () => {
        // Arrange
        const zeroString = '0'

        // Act
        const result = requestHandlerLabel(zeroString)

        // Assert
        expect(result).toBe('0')
      })

      it('should handle the string "false"', () => {
        // Arrange
        const falseString = 'false'

        // Act
        const result = requestHandlerLabel(falseString)

        // Assert
        expect(result).toBe('false')
      })

      it('should handle the string "null"', () => {
        // Arrange
        const nullString = 'null'

        // Act
        const result = requestHandlerLabel(nullString)

        // Assert
        expect(result).toBe('null')
      })
    })
  })
})
