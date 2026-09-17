import { HttpAgentSingleton } from './HttpAgentSingleton'

// Mock the createHttpAgent function (external dependency)
jest.mock('../../../HttpClient/agents', () => ({
  createHttpAgent: jest.fn(() => ({
    sockets: {},
    freeSockets: {},
    requests: {},
  })),
}))

describe('HttpAgentSingleton', () => {
  let recordedGaugeCalls: Map<string, Array<{ value: number; attributes?: any }>>

  beforeEach(() => {
    // Reset call tracking
    recordedGaugeCalls = new Map()

    // Create a minimal stub that tracks gauge calls (not mocking DiagnosticsMetrics class)
    global.diagnosticsMetrics = {
      setGauge: (name: string, value: number, attributes?: any) => {
        if (!recordedGaugeCalls.has(name)) {
          recordedGaugeCalls.set(name, [])
        }
        recordedGaugeCalls.get(name)!.push({ value, attributes })
      },
    } as any
    
    // Reset the agent's internal state
    const agent = HttpAgentSingleton.getHttpAgent()
    ;(agent as any).sockets = {}
    ;(agent as any).freeSockets = {}
    ;(agent as any).requests = {}
  })

  afterEach(() => {
    // Clean up global
    delete (global as any).diagnosticsMetrics
  })

  describe('httpAgentStats', () => {
    it('should return current HTTP agent statistics', () => {
      const agent = HttpAgentSingleton.getHttpAgent()
      
      // Mock some socket data
      ;(agent as any).sockets = { 'host1:80': [1, 2], 'host2:443': [1] }
      ;(agent as any).freeSockets = { 'host1:80': [1] }
      ;(agent as any).requests = { 'host1:80': [1, 2, 3] }

      const stats = HttpAgentSingleton.httpAgentStats()

      expect(stats).toEqual({
        sockets: 3,
        freeSockets: 1,
        pendingRequests: 3,
      })
    })

    it('should return zero counts for empty agent', () => {
      const stats = HttpAgentSingleton.httpAgentStats()

      expect(stats).toEqual({
        sockets: 0,
        freeSockets: 0,
        pendingRequests: 0,
      })
    })
  })

  describe('updateHttpAgentMetrics', () => {
    it('should report HTTP agent stats as gauges to diagnostics metrics', () => {
      const agent = HttpAgentSingleton.getHttpAgent()
      
      // Mock some socket data
      ;(agent as any).sockets = { 'host1:80': [1, 2] }
      ;(agent as any).freeSockets = { 'host1:80': [1] }
      ;(agent as any).requests = { 'host1:80': [1, 2, 3] }

      HttpAgentSingleton.updateHttpAgentMetrics()

      expect(recordedGaugeCalls.get('http_agent_sockets_current')).toEqual([{ value: 2, attributes: {} }])
      expect(recordedGaugeCalls.get('http_agent_free_sockets_current')).toEqual([{ value: 1, attributes: {} }])
      expect(recordedGaugeCalls.get('http_agent_pending_requests_current')).toEqual([{ value: 3, attributes: {} }])
    })

    it('should handle missing global.diagnosticsMetrics gracefully', () => {
      delete (global as any).diagnosticsMetrics

      // Should not throw
      expect(() => HttpAgentSingleton.updateHttpAgentMetrics()).not.toThrow()
    })

    it('should report zero values when agent has no active connections', () => {
      HttpAgentSingleton.updateHttpAgentMetrics()

      expect(recordedGaugeCalls.get('http_agent_sockets_current')).toEqual([{ value: 0, attributes: {} }])
      expect(recordedGaugeCalls.get('http_agent_free_sockets_current')).toEqual([{ value: 0, attributes: {} }])
      expect(recordedGaugeCalls.get('http_agent_pending_requests_current')).toEqual([{ value: 0, attributes: {} }])
    })
  })
})

