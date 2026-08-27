import cluster from 'cluster'
import * as constants from '../../../constants'
import { HttpAgentSingleton } from '../../../HttpClient/middlewares/request/HttpAgentSingleton'
import {
  isStatusTrack,
  isStatusTrackBroadcast,
  statusTrackHandler,
  trackStatus,
  broadcastStatusTrack,
  StatusTrack,
  NamedMetric,
  EnvMetric,
} from './statusTrack'
import { ServiceContext } from './typings'

jest.mock('cluster')
jest.mock('../../../constants')
jest.mock('../../../HttpClient/middlewares/request/HttpAgentSingleton')

describe('statusTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('isStatusTrack', () => {
    it('should return true when message equals STATUS_TRACK string', () => {
      // Arrange
      const message = 'statusTrack'

      // Act
      const result = isStatusTrack(message)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when message is a different string', () => {
      // Arrange
      const message = 'otherMessage'

      // Act
      const result = isStatusTrack(message)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when message is null', () => {
      // Arrange
      const message = null

      // Act
      const result = isStatusTrack(message)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when message is undefined', () => {
      // Arrange
      const message = undefined

      // Act
      const result = isStatusTrack(message)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when message is an object', () => {
      // Arrange
      const message = { statusTrack: true }

      // Act
      const result = isStatusTrack(message)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when message is a number', () => {
      // Arrange
      const message = 123

      // Act
      const result = isStatusTrack(message)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('isStatusTrackBroadcast', () => {
    it('should return true when message equals BROADCAST_STATUS_TRACK string', () => {
      // Arrange
      const message = 'broadcastStatusTrack'

      // Act
      const result = isStatusTrackBroadcast(message)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when message is a different string', () => {
      // Arrange
      const message = 'someOtherMessage'

      // Act
      const result = isStatusTrackBroadcast(message)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when message is null', () => {
      // Arrange
      const message = null

      // Act
      const result = isStatusTrackBroadcast(message)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when message is undefined', () => {
      // Arrange
      const message = undefined

      // Act
      const result = isStatusTrackBroadcast(message)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when message is an object', () => {
      // Arrange
      const message = { broadcast: true }

      // Act
      const result = isStatusTrackBroadcast(message)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('statusTrackHandler', () => {
    let mockCtx: Partial<ServiceContext>
    let mockSpan: any

    beforeEach(() => {
      mockSpan = {
        setOperationName: jest.fn(),
      }
      mockCtx = {
        requestHandlerName: '',
        tracing: {
          currentSpan: mockSpan,
        },
        body: undefined,
      }
      jest.spyOn(process, 'send').mockImplementation(() => true)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should set requestHandlerName to builtin:status-track', async () => {
      // Arrange
      ;(constants.LINKED as any) = true

      // Act
      await statusTrackHandler(mockCtx as ServiceContext)

      // Assert
      expect(mockCtx.requestHandlerName).toBe('builtin:status-track')
    })

    it('should call setOperationName on currentSpan when tracing exists', async () => {
      // Arrange
      ;(constants.LINKED as any) = true

      // Act
      await statusTrackHandler(mockCtx as ServiceContext)

      // Assert
      expect(mockSpan.setOperationName).toHaveBeenCalledWith('builtin:status-track')
    })

    it('should not call setOperationName when currentSpan is undefined', async () => {
      // Arrange
      ;(constants.LINKED as any) = true
      mockCtx.tracing = { currentSpan: undefined }

      // Act & Assert - should not throw
      await expect(
        statusTrackHandler(mockCtx as ServiceContext)
      ).resolves.toBeUndefined()
    })

    it('should not call setOperationName when tracing is undefined', async () => {
      // Arrange
      ;(constants.LINKED as any) = true
      mockCtx.tracing = undefined

      // Act & Assert - should not throw
      await expect(
        statusTrackHandler(mockCtx as ServiceContext)
      ).resolves.toBeUndefined()
    })

    it('should send BROADCAST_STATUS_TRACK when LINKED is false', async () => {
      // Arrange
      ;(constants.LINKED as any) = false
      const sendSpy = jest.spyOn(process, 'send').mockImplementation(() => true)

      // Act
      await statusTrackHandler(mockCtx as ServiceContext)

      // Assert
      expect(sendSpy).toHaveBeenCalledWith('broadcastStatusTrack')
    })

    it('should not send BROADCAST_STATUS_TRACK when LINKED is true', async () => {
      // Arrange
      ;(constants.LINKED as any) = true
      const sendSpy = jest.spyOn(process, 'send').mockImplementation(() => true)

      // Act
      await statusTrackHandler(mockCtx as ServiceContext)

      // Assert
      expect(sendSpy).not.toHaveBeenCalled()
    })

    it('should handle process.send being undefined gracefully', async () => {
      // Arrange
      ;(constants.LINKED as any) = false
      jest.spyOn(process, 'send', 'get').mockReturnValue(undefined)

      // Act & Assert - should not throw
      await expect(
        statusTrackHandler(mockCtx as ServiceContext)
      ).resolves.toBeUndefined()
    })

    it('should set ctx.body to empty array', async () => {
      // Arrange
      ;(constants.LINKED as any) = true

      // Act
      await statusTrackHandler(mockCtx as ServiceContext)

      // Assert
      expect(mockCtx.body).toEqual([])
    })

    it('should return undefined', async () => {
      // Arrange
      ;(constants.LINKED as any) = true

      // Act
      const result = await statusTrackHandler(mockCtx as ServiceContext)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('trackStatus', () => {
    let mockGlobalMetrics: any

    beforeEach(() => {
      mockGlobalMetrics = {
        statusTrack: jest.fn(),
      }
      ;(global as any).metrics = mockGlobalMetrics
    })

    afterEach(() => {
      delete (global as any).metrics
    })

    it('should call HttpAgentSingleton.updateHttpAgentMetrics', () => {
      // Arrange
      const updateSpy = jest.spyOn(HttpAgentSingleton, 'updateHttpAgentMetrics')

      // Act
      trackStatus()

      // Assert
      expect(updateSpy).toHaveBeenCalledTimes(1)
    })

    it('should call global.metrics.statusTrack', () => {
      // Arrange
      const statusTrackSpy = jest.fn()
      ;(global as any).metrics = { statusTrack: statusTrackSpy }

      // Act
      trackStatus()

      // Assert
      expect(statusTrackSpy).toHaveBeenCalledTimes(1)
    })

    it('should call updateHttpAgentMetrics before statusTrack', () => {
      // Arrange
      const callOrder: string[] = []
      jest.spyOn(HttpAgentSingleton, 'updateHttpAgentMetrics').mockImplementation(() => {
        callOrder.push('updateHttpAgentMetrics')
      })
      ;(global as any).metrics = {
        statusTrack: () => {
          callOrder.push('statusTrack')
        },
      }

      // Act
      trackStatus()

      // Assert
      expect(callOrder).toEqual(['updateHttpAgentMetrics', 'statusTrack'])
    })

    it('should handle metrics.statusTrack throwing an error', () => {
      // Arrange
      ;(global as any).metrics = {
        statusTrack: jest.fn(() => {
          throw new Error('Metrics error')
        }),
      }

      // Act & Assert
      expect(() => trackStatus()).toThrow('Metrics error')
    })

    it('should handle HttpAgentSingleton.updateHttpAgentMetrics throwing an error', () => {
      // Arrange
      jest
        .spyOn(HttpAgentSingleton, 'updateHttpAgentMetrics')
        .mockImplementation(() => {
          throw new Error('HttpAgent error')
        })

      // Act & Assert
      expect(() => trackStatus()).toThrow('HttpAgent error')
    })
  })

  describe('broadcastStatusTrack', () => {
    it('should send STATUS_TRACK to each worker', () => {
      // Arrange
      const mockWorker1 = { send: jest.fn() }
      const mockWorker2 = { send: jest.fn() }
      ;(cluster.workers as any) = {
        1: mockWorker1,
        2: mockWorker2,
      }

      // Act
      broadcastStatusTrack()

      // Assert
      expect(mockWorker1.send).toHaveBeenCalledWith('statusTrack')
      expect(mockWorker2.send).toHaveBeenCalledWith('statusTrack')
    })

    it('should handle empty cluster.workers object', () => {
      // Arrange
      ;(cluster.workers as any) = {}

      // Act & Assert - should not throw
      expect(() => broadcastStatusTrack()).not.toThrow()
    })

    it('should skip null or undefined workers', () => {
      // Arrange
      const mockWorker = { send: jest.fn() }
      ;(cluster.workers as any) = {
        1: mockWorker,
        2: null,
        3: undefined,
      }

      // Act
      broadcastStatusTrack()

      // Assert
      expect(mockWorker.send).toHaveBeenCalledWith('statusTrack')
      // Only one worker should have received the message
      expect(mockWorker.send).toHaveBeenCalledTimes(1)
    })

    it('should handle worker.send being undefined gracefully', () => {
      // Arrange
      const mockWorker1 = { send: jest.fn() }
      const mockWorker2 = {} // no send method
      ;(cluster.workers as any) = {
        1: mockWorker1,
        2: mockWorker2,
      }

      // Act & Assert - should not throw
      expect(() => broadcastStatusTrack()).not.toThrow()
    })

    it('should handle all workers being null', () => {
      // Arrange
      ;(cluster.workers as any) = {
        1: null,
        2: null,
      }

      // Act & Assert - should not throw
      expect(() => broadcastStatusTrack()).not.toThrow()
    })

    it('should send to multiple workers independently', () => {
      // Arrange
      const mockWorker1 = { send: jest.fn() }
      const mockWorker2 = { send: jest.fn() }
      const mockWorker3 = { send: jest.fn() }
      ;(cluster.workers as any) = {
        1: mockWorker1,
        2: mockWorker2,
        3: mockWorker3,
      }

      // Act
      broadcastStatusTrack()

      // Assert
      expect(mockWorker1.send).toHaveBeenCalledTimes(1)
      expect(mockWorker2.send).toHaveBeenCalledTimes(1)
      expect(mockWorker3.send).toHaveBeenCalledTimes(1)
    })
  })

  describe('Type definitions', () => {
    it('should have NamedMetric interface with name and arbitrary properties', () => {
      // Arrange
      const metric: NamedMetric = {
        name: 'test-metric',
        customProp: 'value',
        anotherProp: 123,
      }

      // Act & Assert
      expect(metric.name).toBe('test-metric')
      expect(metric.customProp).toBe('value')
      expect(metric.anotherProp).toBe(123)
    })

    it('should have EnvMetric interface extending NamedMetric with production flag', () => {
      // Arrange
      const metric: EnvMetric = {
        name: 'env-metric',
        production: true,
        customData: 'test',
      }

      // Act & Assert
      expect(metric.name).toBe('env-metric')
      expect(metric.production).toBe(true)
      expect(metric.customData).toBe('test')
    })

    it('should support StatusTrack function type', () => {
      // Arrange
      const mockStatusTrack: StatusTrack = () => [
        { name: 'metric1', production: true },
        { name: 'metric2', production: false },
      ]

      // Act
      const result = mockStatusTrack()

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('metric1')
      expect(result[0].production).toBe(true)
    })
  })
})
