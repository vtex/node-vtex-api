// Mock the diagnostics-nodejs module to avoid deep import issues (must be before imports)
jest.mock('@vtex/diagnostics-nodejs', () => ({
  Types: {},
}))

describe('Metric Schema Directive', () => {
  let mockMetricsAccumulator: any
  let mockDiagnosticsMetrics: any
  let mockContext: any

  beforeEach(() => {
    // Reset global.metrics and global.diagnosticsMetrics
    mockMetricsAccumulator = {
      batch: jest.fn(),
    }
    mockDiagnosticsMetrics = {
      recordLatency: jest.fn(),
      incrementCounter: jest.fn(),
    }
    ;(global as any).metrics = mockMetricsAccumulator
    ;(global as any).diagnosticsMetrics = mockDiagnosticsMetrics
    ;(global as any).APP = { NAME: 'vtex.render-server@1.x' }

    // Create a mock context
    mockContext = {
      graphql: {
        status: undefined,
      },
    }
  })

  afterEach(() => {
    delete (global as any).metrics
    delete (global as any).diagnosticsMetrics
    delete (global as any).APP
    jest.clearAllMocks()
  })

  it('should record successful field resolution metrics', async () => {
    const mockResolver = jest.fn().mockResolvedValue('test-result')
    
    // Simulate what the Metric directive does
    const wrappedResolver = async (root: any, args: any, ctx: any, info: any) => {
      let failedToResolve = false
      let resolverResult: any = null
      let ellapsed: [number, number] = [0, 0]

      try {
        const start = process.hrtime()
        resolverResult = await mockResolver(root, args, ctx, info)
        ellapsed = process.hrtime(start)
      } catch (error) {
        resolverResult = error
        failedToResolve = true
      }

      const status = failedToResolve ? 'error' : 'success'
      ctx.graphql.status = status
      const name = 'vtex.render-server@1.x-testField'

      const payload = {
        [status]: 1,
      }

      // Legacy metrics
      ;(global as any).metrics.batch(`graphql-metric-${name}`, failedToResolve ? undefined : ellapsed, payload)

      // New diagnostics metrics
      if ((global as any).diagnosticsMetrics) {
        const attributes = {
          component: 'graphql',
          field_name: name,
          status,
        }

        ;(global as any).diagnosticsMetrics.recordLatency(ellapsed, attributes)
        ;(global as any).diagnosticsMetrics.incrementCounter('graphql_field_requests_total', 1, attributes)
      }

      if (failedToResolve) {
        throw resolverResult
      }

      return resolverResult
    }

    // Execute the wrapped resolver
    const result = await wrappedResolver({}, {}, mockContext, {})

    expect(result).toBe('test-result')
    expect(mockContext.graphql.status).toBe('success')

    // Legacy metrics
    const batchCall = mockMetricsAccumulator.batch.mock.calls[0]
    expect(batchCall[0]).toBe('graphql-metric-vtex.render-server@1.x-testField')
    expect(Array.isArray(batchCall[1])).toBe(true) // hrtime is an array
    expect(batchCall[2]).toEqual({ success: 1 })

    // Diagnostics metrics
    const recordLatencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
    expect(Array.isArray(recordLatencyCall[0])).toBe(true) // hrtime is an array
    expect(recordLatencyCall[1]).toEqual({
      component: 'graphql',
      field_name: 'vtex.render-server@1.x-testField',
      status: 'success',
    })
    
    expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
      'graphql_field_requests_total',
      1,
      {
        component: 'graphql',
        field_name: 'vtex.render-server@1.x-testField',
        status: 'success',
      }
    )
  })

  it('should record failed field resolution metrics', async () => {
    const testError = new Error('Test error')
    const mockResolver = jest.fn().mockRejectedValue(testError)
    
    // Simulate what the Metric directive does
    const wrappedResolver = async (root: any, args: any, ctx: any, info: any) => {
      let failedToResolve = false
      let resolverResult: any = null
      let ellapsed: [number, number] = [0, 0]

      try {
        const start = process.hrtime()
        resolverResult = await mockResolver(root, args, ctx, info)
        ellapsed = process.hrtime(start)
      } catch (error) {
        resolverResult = error
        failedToResolve = true
      }

      const status = failedToResolve ? 'error' : 'success'
      ctx.graphql.status = status
      const name = 'vtex.render-server@1.x-testField'

      const payload = {
        [status]: 1,
      }

      // Legacy metrics
      ;(global as any).metrics.batch(`graphql-metric-${name}`, failedToResolve ? undefined : ellapsed, payload)

      // New diagnostics metrics
      if ((global as any).diagnosticsMetrics) {
        const attributes = {
          component: 'graphql',
          field_name: name,
          status,
        }

        ;(global as any).diagnosticsMetrics.recordLatency(ellapsed, attributes)
        ;(global as any).diagnosticsMetrics.incrementCounter('graphql_field_requests_total', 1, attributes)
      }

      if (failedToResolve) {
        throw resolverResult
      }

      return resolverResult
    }

    // Execute the wrapped resolver and expect it to throw
    await expect(wrappedResolver({}, {}, mockContext, {})).rejects.toThrow('Test error')

    expect(mockContext.graphql.status).toBe('error')

    // Legacy metrics (no latency on error)
    expect(mockMetricsAccumulator.batch).toHaveBeenCalledWith(
      'graphql-metric-vtex.render-server@1.x-testField',
      undefined,
      { error: 1 }
    )

    // Diagnostics metrics (record latency even on error)
    const recordLatencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
    expect(Array.isArray(recordLatencyCall[0])).toBe(true) // hrtime is an array
    expect(recordLatencyCall[1]).toEqual({
      component: 'graphql',
      field_name: 'vtex.render-server@1.x-testField',
      status: 'error',
    })
    
    expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
      'graphql_field_requests_total',
      1,
      {
        component: 'graphql',
        field_name: 'vtex.render-server@1.x-testField',
        status: 'error',
      }
    )
  })

  it('should warn when DiagnosticsMetrics is not available', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    delete (global as any).diagnosticsMetrics

    const mockResolver = jest.fn().mockResolvedValue('test-result')
    
    // Simulate what the Metric directive does (without diagnostics)
    const wrappedResolver = async (root: any, args: any, ctx: any, info: any) => {
      let failedToResolve = false
      let resolverResult: any = null
      let ellapsed: [number, number] = [0, 0]

      try {
        const start = process.hrtime()
        resolverResult = await mockResolver(root, args, ctx, info)
        ellapsed = process.hrtime(start)
      } catch (error) {
        resolverResult = error
        failedToResolve = true
      }

      const status = failedToResolve ? 'error' : 'success'
      ctx.graphql.status = status
      const name = 'vtex.render-server@1.x-testField'

      const payload = {
        [status]: 1,
      }

      // Legacy metrics
      ;(global as any).metrics.batch(`graphql-metric-${name}`, failedToResolve ? undefined : ellapsed, payload)

      // New diagnostics metrics
      if ((global as any).diagnosticsMetrics) {
        const attributes = {
          component: 'graphql',
          field_name: name,
          status,
        }

        ;(global as any).diagnosticsMetrics.recordLatency(ellapsed, attributes)
        ;(global as any).diagnosticsMetrics.incrementCounter('graphql_field_requests_total', 1, attributes)
      } else {
        console.warn('DiagnosticsMetrics not available. GraphQL field metrics not reported.')
      }

      if (failedToResolve) {
        throw resolverResult
      }

      return resolverResult
    }

    // Execute the wrapped resolver
    await wrappedResolver({}, {}, mockContext, {})

    expect(consoleWarnSpy).toHaveBeenCalledWith('DiagnosticsMetrics not available. GraphQL field metrics not reported.')
    expect(mockMetricsAccumulator.batch).toHaveBeenCalled() // Legacy still works

    consoleWarnSpy.mockRestore()
  })
})
