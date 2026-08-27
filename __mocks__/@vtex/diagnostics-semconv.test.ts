import {
  ATTR_VTEX_ACCOUNT_NAME,
  ATTR_VTEX_IO_WORKSPACE_NAME,
  ATTR_VTEX_IO_WORKSPACE_TYPE,
  ATTR_VTEX_IO_APP_ID,
  ATTR_VTEX_IO_APP_AUTHOR_TYPE,
  ATTR_VTEX_IO_CLUSTER_ID,
  ATTR_VTEX_IO_CLUSTER_ROLE,
} from './diagnostics-semconv'

describe('@vtex/diagnostics-semconv mock', () => {
  describe('exported constants', () => {
    it('should export ATTR_VTEX_ACCOUNT_NAME with correct value', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_ACCOUNT_NAME).toBe('vtex.account.name')
    })

    it('should export ATTR_VTEX_IO_WORKSPACE_NAME with correct value', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_WORKSPACE_NAME).toBe('vtex_io.workspace.name')
    })

    it('should export ATTR_VTEX_IO_WORKSPACE_TYPE with correct value', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_WORKSPACE_TYPE).toBe('vtex_io.workspace.type')
    })

    it('should export ATTR_VTEX_IO_APP_ID with correct value', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_APP_ID).toBe('vtex_io.app.id')
    })

    it('should export ATTR_VTEX_IO_APP_AUTHOR_TYPE with correct value', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_APP_AUTHOR_TYPE).toBe('vtex_io.app.author-type')
    })

    it('should export ATTR_VTEX_IO_CLUSTER_ID with correct value', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_CLUSTER_ID).toBe('vtex_io.cluster.id')
    })

    it('should export ATTR_VTEX_IO_CLUSTER_ROLE with correct value', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_CLUSTER_ROLE).toBe('vtex_io.cluster.role')
    })
  })

  describe('constants are strings', () => {
    it('ATTR_VTEX_ACCOUNT_NAME should be a string', () => {
      // Arrange & Act & Assert
      expect(typeof ATTR_VTEX_ACCOUNT_NAME).toBe('string')
    })

    it('ATTR_VTEX_IO_WORKSPACE_NAME should be a string', () => {
      // Arrange & Act & Assert
      expect(typeof ATTR_VTEX_IO_WORKSPACE_NAME).toBe('string')
    })

    it('ATTR_VTEX_IO_WORKSPACE_TYPE should be a string', () => {
      // Arrange & Act & Assert
      expect(typeof ATTR_VTEX_IO_WORKSPACE_TYPE).toBe('string')
    })

    it('ATTR_VTEX_IO_APP_ID should be a string', () => {
      // Arrange & Act & Assert
      expect(typeof ATTR_VTEX_IO_APP_ID).toBe('string')
    })

    it('ATTR_VTEX_IO_APP_AUTHOR_TYPE should be a string', () => {
      // Arrange & Act & Assert
      expect(typeof ATTR_VTEX_IO_APP_AUTHOR_TYPE).toBe('string')
    })

    it('ATTR_VTEX_IO_CLUSTER_ID should be a string', () => {
      // Arrange & Act & Assert
      expect(typeof ATTR_VTEX_IO_CLUSTER_ID).toBe('string')
    })

    it('ATTR_VTEX_IO_CLUSTER_ROLE should be a string', () => {
      // Arrange & Act & Assert
      expect(typeof ATTR_VTEX_IO_CLUSTER_ROLE).toBe('string')
    })
  })

  describe('constants are not empty', () => {
    it('ATTR_VTEX_ACCOUNT_NAME should not be empty', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_ACCOUNT_NAME.length).toBeGreaterThan(0)
    })

    it('ATTR_VTEX_IO_WORKSPACE_NAME should not be empty', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_WORKSPACE_NAME.length).toBeGreaterThan(0)
    })

    it('ATTR_VTEX_IO_WORKSPACE_TYPE should not be empty', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_WORKSPACE_TYPE.length).toBeGreaterThan(0)
    })

    it('ATTR_VTEX_IO_APP_ID should not be empty', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_APP_ID.length).toBeGreaterThan(0)
    })

    it('ATTR_VTEX_IO_APP_AUTHOR_TYPE should not be empty', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_APP_AUTHOR_TYPE.length).toBeGreaterThan(0)
    })

    it('ATTR_VTEX_IO_CLUSTER_ID should not be empty', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_CLUSTER_ID.length).toBeGreaterThan(0)
    })

    it('ATTR_VTEX_IO_CLUSTER_ROLE should not be empty', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_CLUSTER_ROLE.length).toBeGreaterThan(0)
    })
  })

  describe('constants uniqueness', () => {
    it('all constants should have unique values', () => {
      // Arrange
      const constants = [
        ATTR_VTEX_ACCOUNT_NAME,
        ATTR_VTEX_IO_WORKSPACE_NAME,
        ATTR_VTEX_IO_WORKSPACE_TYPE,
        ATTR_VTEX_IO_APP_ID,
        ATTR_VTEX_IO_APP_AUTHOR_TYPE,
        ATTR_VTEX_IO_CLUSTER_ID,
        ATTR_VTEX_IO_CLUSTER_ROLE,
      ]

      // Act
      const uniqueConstants = new Set(constants)

      // Assert
      expect(uniqueConstants.size).toBe(constants.length)
    })
  })

  describe('constants naming pattern consistency', () => {
    it('ATTR_VTEX_ACCOUNT_NAME should follow expected naming convention', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_ACCOUNT_NAME).toMatch(/^[a-z]+\.[a-z]+\.[a-z]+$/)
    })

    it('ATTR_VTEX_IO_WORKSPACE_NAME should follow expected naming convention', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_WORKSPACE_NAME).toMatch(/^[a-z_]+\.[a-z_]+\.[a-z]+$/)
    })

    it('ATTR_VTEX_IO_WORKSPACE_TYPE should follow expected naming convention', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_WORKSPACE_TYPE).toMatch(/^[a-z_]+\.[a-z_]+\.[a-z]+$/)
    })

    it('ATTR_VTEX_IO_APP_ID should follow expected naming convention', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_APP_ID).toMatch(/^[a-z_]+\.[a-z_]+\.[a-z]+$/)
    })

    it('ATTR_VTEX_IO_APP_AUTHOR_TYPE should follow expected naming convention', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_APP_AUTHOR_TYPE).toMatch(/^[a-z_]+(\.[a-z_]+|-[a-z]+)\.[a-z]+$/)
    })

    it('ATTR_VTEX_IO_CLUSTER_ID should follow expected naming convention', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_CLUSTER_ID).toMatch(/^[a-z_]+\.[a-z_]+\.[a-z]+$/)
    })

    it('ATTR_VTEX_IO_CLUSTER_ROLE should follow expected naming convention', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_IO_CLUSTER_ROLE).toMatch(/^[a-z_]+\.[a-z_]+\.[a-z]+$/)
    })
  })

  describe('constants immutability', () => {
    it('ATTR_VTEX_ACCOUNT_NAME should not be reassigned', () => {
      // Arrange
      const original = ATTR_VTEX_ACCOUNT_NAME

      // Act & Assert
      expect(ATTR_VTEX_ACCOUNT_NAME).toBe(original)
    })

    it('all constants should remain consistent across multiple imports', () => {
      // Arrange & Act & Assert
      expect(ATTR_VTEX_ACCOUNT_NAME).toBe('vtex.account.name')
      expect(ATTR_VTEX_IO_WORKSPACE_NAME).toBe('vtex_io.workspace.name')
      expect(ATTR_VTEX_IO_WORKSPACE_TYPE).toBe('vtex_io.workspace.type')
      expect(ATTR_VTEX_IO_APP_ID).toBe('vtex_io.app.id')
      expect(ATTR_VTEX_IO_APP_AUTHOR_TYPE).toBe('vtex_io.app.author-type')
      expect(ATTR_VTEX_IO_CLUSTER_ID).toBe('vtex_io.cluster.id')
      expect(ATTR_VTEX_IO_CLUSTER_ROLE).toBe('vtex_io.cluster.role')
    })
  })
})
