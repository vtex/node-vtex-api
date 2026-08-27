import { requestHandlerLabel, UNNAMED_REQUEST_HANDLER } from './requestHandlerLabel'

describe('requestHandlerLabel', () => {
  describe('UNNAMED_REQUEST_HANDLER constant', () => {
    it('should be defined as the string "undefined"', () => {
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
    describe('happy path - defined handler names', () => {
      it('should return the provided handler name when a non-empty string is given', () => {
        // Arrange
        const handlerName = 'getUser'

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('getUser')
      })

      it('should return handler name for a simple route', () => {
        // Arrange
        const handlerName = 'listItems'

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('listItems')
      })

      it('should return handler name with special characters', () => {
        // Arrange
        const handlerName = 'api:v1/getUserById'

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('api:v1/getUserById')
      })

      it('should return handler name with numbers and underscores', () => {
        // Arrange
        const handlerName = 'handle_user_v2_request'

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('handle_user_v2_request')
      })

      it('should return handler name with hyphens', () => {
        // Arrange
        const handlerName = 'list-active-users'

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('list-active-users')
      })
    })

    describe('fallback to UNNAMED_REQUEST_HANDLER', () => {
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
      })

      it('should return UNNAMED_REQUEST_HANDLER when an empty string is provided', () => {
        // Arrange
        const handlerName = ''

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe(UNNAMED_REQUEST_HANDLER)
      })
    })

    describe('edge cases and boundary values', () => {
      it('should return a string with only whitespace as the handler name', () => {
        // Arrange
        const handlerName = '   '

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('   ')
        expect(result).not.toBe(UNNAMED_REQUEST_HANDLER)
      })

      it('should return a string with a single space character as the handler name', () => {
        // Arrange
        const handlerName = ' '

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe(' ')
      })

      it('should return a single character handler name', () => {
        // Arrange
        const handlerName = 'a'

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('a')
      })

      it('should return a very long handler name', () => {
        // Arrange
        const handlerName = 'a'.repeat(1000)

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe(handlerName)
        expect(result.length).toBe(1000)
      })

      it('should return handler name with leading zeros', () => {
        // Arrange
        const handlerName = '000handler'

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('000handler')
      })

      it('should return handler name with dots and slashes', () => {
        // Arrange
        const handlerName = '/api/v1.0/endpoint'

        // Act
        const result = requestHandlerLabel(handlerName)

        // Assert
        expect(result).toBe('/api/v1.0/endpoint')
      })
    })

    describe('consistency and determinism', () => {
      it('should return the same value on repeated calls with the same input', () => {
        // Arrange
        const handlerName = 'consistentHandler'

        // Act
        const result1 = requestHandlerLabel(handlerName)
        const result2 = requestHandlerLabel(handlerName)
        const result3 = requestHandlerLabel(handlerName)

        // Assert
        expect(result1).toBe(result2)
        expect(result2).toBe(result3)
      })

      it('should return UNNAMED_REQUEST_HANDLER consistently for undefined inputs', () => {
        // Arrange & Act
        const result1 = requestHandlerLabel(undefined)
        const result2 = requestHandlerLabel()
        const result3 = requestHandlerLabel(undefined)

        // Assert
        expect(result1).toBe(result2)
        expect(result2).toBe(result3)
        expect(result1).toBe(UNNAMED_REQUEST_HANDLER)
      })

      it('should return UNNAMED_REQUEST_HANDLER consistently for empty strings', () => {
        // Arrange & Act
        const result1 = requestHandlerLabel('')
        const result2 = requestHandlerLabel('')

        // Assert
        expect(result1).toBe(result2)
        expect(result1).toBe(UNNAMED_REQUEST_HANDLER)
      })
    })

    describe('type safety', () => {
      it('should return a string type', () => {
        // Arrange & Act
        const result = requestHandlerLabel('test')

        // Assert
        expect(typeof result).toBe('string')
      })

      it('should return a string type even when undefined is passed', () => {
        // Arrange & Act
        const result = requestHandlerLabel(undefined)

        // Assert
        expect(typeof result).toBe('string')
      })

      it('should always return a non-empty string', () => {
        // Arrange & Act
        const result1 = requestHandlerLabel('handler')
        const result2 = requestHandlerLabel('')
        const result3 = requestHandlerLabel(undefined)

        // Assert
        expect(result1.length).toBeGreaterThan(0)
        expect(result2.length).toBeGreaterThan(0)
        expect(result3.length).toBeGreaterThan(0)
      })
    })
  })
})
