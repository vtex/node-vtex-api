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
    jest.restoreAllMocks()
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

    it('should return false when message is not STATUS_TRACK', () => {
      // Arrange
      const message = 'someOtherMessage'

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

    it('should return false when message is not BROADCAST_STATUS_TRACK', () => {
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
      const message = { broadcastStatusTrack: true }

      // Act
      const result = isStatusTrackBroadcast(message)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('statusTrackHandler', () => {
    it('should set requestHandlerName on context', async () => {
      // Arrange
      const ctx = {
        requestHandlerName: '',
        tracing: undefined,
        body: undefined,
      } as unknown as ServiceContext
      jest.spyOn(constants, 'LINKED', 'get').mockReturnValue(false)
      const sendMock = jest.fn()
      jest.spyOn(process, 'send', 'get').mockReturnValue(sendMock as any)

      // Act
      await statusTrackHandler(ctx)

      // Assert
      expect(ctx.requestHandlerName).toBe('builtin:status-track')
    })

    it('should set operation name on current span if tracing exists', async () => {
      // Arrange
      const setOperationNameMock = jest.fn()
      const ctx = {
        requestHandlerName: '',
        tracing: {
          currentSpan: {
            setOperationName: setOperationNameMock,
          },
        },
        body: undefined,
      } as unknown as ServiceContext
      jest.spyOn(constants, 'LINKED', 'get').mockReturnValue(false)
      const sendMock = jest.fn()
      jest.spyOn(process, 'send', 'get').mockReturnValue(sendMock as any)

      // Act
      await statusTrackHandler(ctx)

      // Assert
      expect(setOperationNameMock).toHaveBeenCalledWith('builtin:status-track')
    })

    it('should not set operation name if tracing is undefined', async () => {
      // Arrange
      const ctx = {
        requestHandlerName: '',
        tracing: undefined,
        body: undefined,
      } as unknown as ServiceContext
      jest.spyOn(constants, 'LINKED', 'get').mockReturnValue(false)
      const sendMock = jest.fn()
      jest.spyOn(process, 'send', 'get').mockReturnValue(sendMock as any)

      // Act & Assert
      await expect(statusTrackHandler(ctx)).resolves.not.toThrow()
    })

    it('should send BROADCAST_STATUS_TRACK when LINKED is false', async () => {
      // Arrange
      const ctx = {
        requestHandlerName: '',
        tracing: undefined,
        body: undefined,
      } as unknown as ServiceContext
      jest.spyOn(constants, 'LINKED', 'get').mockReturnValue(false)
      const sendMock = jest.fn()
      jest.spyOn(process, 'send', 'get').mockReturnValue(sendMock as any)

      // Act
      await statusTrackHandler(ctx)

      // Assert
      expect(sendMock).toHaveBeenCalledWith('broadcastStatusTrack')
    })

    it('should not send message when LINKED is true', async () => {
      // Arrange
      const ctx = {
        requestHandlerName: '',
        tracing: undefined,
        body: undefined,
      } as unknown as ServiceContext
      jest.spyOn(constants, 'LINKED', 'get').mockReturnValue(true)
      const sendMock = jest.fn()
      jest.spyOn(process, 'send', 'get').mockReturnValue(sendMock as any)

      // Act
      await statusTrackHandler(ctx)

      // Assert
      expect(sendMock).not.toHaveBeenCalled()
    })

    it('should not throw if process.send is undefined', async () => {
      // Arrange
      const ctx = {
        requestHandlerName: '',
        tracing: undefined,
        body: undefined,
      } as unknown as ServiceContext
      jest.spyOn(constants, 'LINKED', 'get').mockReturnValue(false)
      jest.spyOn(process, 'send', 'get').mockReturnValue(undefined)

      // Act & Assert
      await expect(statusTrackHandler(ctx)).resolves.not.toThrow()
    })

    it('should set body to empty array', async () => {
      // Arrange
      const ctx = {
        requestHandlerName: '',
        tracing: undefined,
        body: undefined,
      } as unknown as ServiceContext
      jest.spyOn(constants, 'LINKED', 'get').mockReturnValue(false)
      const sendMock = jest.fn()
      jest.spyOn(process, 'send', 'get').mockReturnValue(sendMock as any)

      // Act
      await statusTrackHandler(ctx)

      // Assert
      expect(ctx.body).toEqual([])
    })

    it('should handle context with tracing but no currentSpan', async () => {
      // Arrange
      const ctx = {
        requestHandlerName: '',
        tracing: {},
        body: undefined,
      } as unknown as ServiceContext
      jest.spyOn(constants, 'LINKED', 'get').mockReturnValue(false)
      const sendMock = jest.fn()
      jest.spyOn(process, 'send', 'get').mockReturnValue(sendMock as any)

      // Act & Assert
      await expect(statusTrackHandler(ctx)).resolves.not.toThrow()
    })
  })

  describe('trackStatus', () => {
    it('should call HttpAgentSingleton.updateHttpAgentMetrics', () => {
      // Arrange
      const updateMock = jest.fn()
      ;(HttpAgentSingleton.updateHttpAgentMetrics as jest.Mock) = updateMock

      // Act
      trackStatus()

      // Assert
      expect(updateMock).toHaveBeenCalled()
    })

    it('should call global.metrics.statusTrack', () => {
      // Arrange
      const statusTrackMock = jest.fn()
      ;(global as any).metrics = {
        statusTrack: statusTrackMock,
      }
      const updateMock = jest.fn()
      ;(HttpAgentSingleton.updateHttpAgentMetrics as jest.Mock) = updateMock

      // Act
      trackStatus()

      // Assert
      expect(statusTrackMock).toHaveBeenCalled()
    })

    it('should call both updateHttpAgentMetrics and statusTrack in order', () => {
      // Arrange
      const callOrder: string[] = []
      const updateMock = jest.fn(() => callOrder.push('updateHttpAgentMetrics'))
      const statusTrackMock = jest.fn(() => callOrder.push('statusTrack'))
      ;(HttpAgentSingleton.updateHttpAgentMetrics as jest.Mock) = updateMock
      ;(global as any).metrics = {
        statusTrack: statusTrackMock,
      }

      // Act
      trackStatus()

      // Assert
      expect(callOrder).toEqual(['updateHttpAgentMetrics', 'statusTrack'])
    })
  })

  describe('broadcastStatusTrack', () => {
    it('should send STATUS_TRACK message to all workers', () => {
      // Arrange
      const sendMock1 = jest.fn()
      const sendMock2 = jest.fn()
      const sendMock3 = jest.fn()
      const mockWorkers = {
        1: { send: sendMock1 },
        2: { send: sendMock2 },
        3: { send: sendMock3 },
      }
      ;(cluster.workers as any) = mockWorkers

      // Act
      broadcastStatusTrack()

      // Assert
      expect(sendMock1).toHaveBeenCalledWith('statusTrack')
      expect(sendMock2).toHaveBeenCalledWith('statusTrack')
      expect(sendMock3).toHaveBeenCalledWith('statusTrack')
    })

    it('should handle empty workers object', () => {
      // Arrange
      ;(cluster.workers as any) = {}

      // Act & Assert
      expect(() => broadcastStatusTrack()).not.toThrow()
    })

    it('should skip null or undefined workers', () => {
      // Arrange
      const sendMock = jest.fn()
      const mockWorkers = {
        1: { send: sendMock },
        2: null,
        3: undefined,
        4: { send: sendMock },
      }
      ;(cluster.workers as any) = mockWorkers

      // Act
      broadcastStatusTrack()

      // Assert
      expect(sendMock).toHaveBeenCalledTimes(2)
      expect(sendMock).toHaveBeenCalledWith('statusTrack')
    })

    it('should handle worker without send method gracefully', () => {
      // Arrange
      const sendMock = jest.fn()
      const mockWorkers = {
        1: { send: sendMock },
        2: { noSend: true },
        3: { send: sendMock },
      }
      ;(cluster.workers as any) = mockWorkers

      // Act & Assert
      expect(() => broadcastStatusTrack()).toThrow()
    })

    it('should send message with correct string constant', () => {
      // Arrange
      const sendMock = jest.fn()
      const mockWorkers = {
        1: { send: sendMock },
      }
      ;(cluster.workers as any) = mockWorkers

      // Act
      broadcastStatusTrack()

      // Assert
      const callArg = sendMock.mock.calls[0][0]
      expect(typeof callArg).toBe('string')
      expect(callArg).toBe('statusTrack')
    })
  })

  describe('Type definitions', () => {
    it('should allow StatusTrack as a function type', () => {
      // Arrange
      const statusTrackFn: StatusTrack = () => []

      // Act
      const result = statusTrackFn()

      // Assert
      expect(Array.isArray(result)).toBe(true)
    })

    it('should allow NamedMetric with any additional properties', () => {
      // Arrange
      const metric: NamedMetric = {
        name: 'test-metric',
        customField: 'custom-value',
        anotherField: 123,
      }

      // Act & Assert
      expect(metric.name).toBe('test-metric')
      expect(metric.customField).toBe('custom-value')
      expect(metric.anotherField).toBe(123)
    })

    it('should allow EnvMetric with production flag', () => {
      // Arrange
      const envMetric: EnvMetric = {
        name: 'env-metric',
        production: true,
        customData: { key: 'value' },
      }

      // Act & Assert
      expect(envMetric.name).toBe('env-metric')
      expect(envMetric.production).toBe(true)
      expect(envMetric.customData).toEqual({ key: 'value' })
    })

    it('should allow EnvMetric with production as false', () => {
      // Arrange
      const envMetric: EnvMetric = {
        name: 'test-metric',
        production: false,
      }

      // Act & Assert
      expect(envMetric.production).toBe(false)
    })
  })
})
