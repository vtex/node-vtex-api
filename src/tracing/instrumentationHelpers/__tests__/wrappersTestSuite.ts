import { REFERENCE_CHILD_OF, REFERENCE_FOLLOWS_FROM } from 'opentracing'
import { ErrorReport } from '../../errorReporting/ErrorReport'
import { SpanReferenceTypes } from '../../spanReference/SpanReferenceTypes'
import { Tags } from '../../Tags'
import { CallerTracingConfig } from '../wrappers'
import { createMockLogger, WrapperTester, WrapperTesterConfig } from './WrapperTester'

interface WrapperTestSuiteConfig {
  wrapperTestConfig: Omit<WrapperTesterConfig, 'useFallbackSpan'>
  expects: {
    expectedReturnValue?: any
    expectedErrorMessage?: string
  }
}

export const registerWrapperTestSuite = ({
  wrapperTestConfig,
  expects: { expectedReturnValue, expectedErrorMessage },
}: WrapperTestSuiteConfig) => {
  it('Creates the expected amount of spans if rootSpan is provided', async () => {
    const { tracerReport } = await WrapperTester.runInstrumentedHandler(wrapperTestConfig)
    expect(tracerReport?.spans.length).toEqual(3)
    expect(tracerReport?.spans[0].operationName()).toEqual('fallback-span')
    expect(tracerReport?.spans[1].operationName()).toEqual('provided-parent-span')
  })

  it('Creates the expected amount of spans if rootSpan is not provided', async () => {
    const { tracerReport } = await WrapperTester.runInstrumentedHandler({ ...wrapperTestConfig, useFallbackSpan: true })
    expect(tracerReport?.spans.length).toEqual(2)
    expect(tracerReport?.spans[0].operationName()).toEqual('fallback-span')
  })

  describe('tracingCtx coherency', () => {
    it(`Doesn't change the original tracingCtx object if a currentSpan is provided`, async () => {
      const tester = new WrapperTester(wrapperTestConfig)
      const originalTracer = tester.tracer
      const originalRootSpan = tester.rootSpan
      const originalSpanId = originalRootSpan.context().toSpanId()
      const originalLogger = createMockLogger()

      const tracingCtx = { tracer: originalTracer, logger: originalLogger, currentSpan: originalRootSpan }
      await tester.runInstrumentedHandler({ tracingCtx })
      expect(tracingCtx.tracer).toStrictEqual(originalTracer)
      expect(tracingCtx.logger).toStrictEqual(originalLogger)
      expect(tracingCtx.currentSpan).toStrictEqual(originalRootSpan)
      expect(tracingCtx.currentSpan.context().toSpanId()).toEqual(originalSpanId)
    })

    it(`Doesn't change the original tracingCtx object if no currentSpan is provided`, async () => {
      const tester = new WrapperTester(wrapperTestConfig)
      const originalTracer = tester.tracer
      const originalLogger = createMockLogger()
      originalLogger.error = jest.fn()

      const tracingCtx: CallerTracingConfig = { tracer: originalTracer, logger: originalLogger }
      await tester.runInstrumentedHandler({ tracingCtx })
      expect(tracingCtx.tracer).toStrictEqual(originalTracer)
      expect(tracingCtx.logger).toStrictEqual(originalLogger)
      expect(originalLogger.error).toBeCalledTimes(0)
      expect(tracingCtx.currentSpan).toBeUndefined()
    })
  })

  it('Finishes all spans', async () => {
    const { tracerReport } = await WrapperTester.runInstrumentedHandler(wrapperTestConfig)
    expect((tracerReport as any)?.unfinishedSpans.length).toBe(0)
  })

  if (expectedReturnValue !== undefined) {
    it('Returns the expected value', async () => {
      const { ret } = await WrapperTester.runInstrumentedHandler(wrapperTestConfig)
      expect(ret).toEqual(expectedReturnValue)
    })
  }

  describe('Span user options', () => {
    it('References the rootSpan with CHILD_OF if no referenceType is provided', async () => {
      const { createdSpan, rootSpan } = await WrapperTester.runInstrumentedHandler(wrapperTestConfig)
      expect(rootSpan.operationName()).toEqual('provided-parent-span')
      expect((createdSpan as any)._references.length).toEqual(1)
      expect((createdSpan as any)._references[0].type()).toEqual(REFERENCE_CHILD_OF)
      expect((createdSpan as any)._references[0].referencedContext().toSpanId()).toEqual(rootSpan.context().toSpanId())
      expect((createdSpan as any)._references[0].referencedContext().toTraceId()).toEqual(
        rootSpan.context().toTraceId()
      )
    })

    it('References the rootSpan with provided referenceType', async () => {
      const { createdSpan, rootSpan } = await WrapperTester.runInstrumentedHandler(wrapperTestConfig, {
        spanReferenceType: SpanReferenceTypes.FOLLOWS_FROM,
      })
      expect(rootSpan.operationName()).toEqual('provided-parent-span')
      expect((createdSpan as any)._references.length).toEqual(1)
      expect((createdSpan as any)._references[0].type()).toEqual(REFERENCE_FOLLOWS_FROM)
      expect((createdSpan as any)._references[0].referencedContext().toSpanId()).toEqual(rootSpan.context().toSpanId())
      expect((createdSpan as any)._references[0].referencedContext().toTraceId()).toEqual(
        rootSpan.context().toTraceId()
      )
    })

    it('References the fallbackSpan with CHILD_OF if no referenceType nor rootSpan are provided', async () => {
      const { createdSpan, rootSpan } = await WrapperTester.runInstrumentedHandler({
        ...wrapperTestConfig,
        useFallbackSpan: true,
      })
      expect(rootSpan.operationName()).toEqual('fallback-span')
      expect((createdSpan as any)._references.length).toEqual(1)
      expect((createdSpan as any)._references[0].type()).toEqual(REFERENCE_CHILD_OF)
      expect((createdSpan as any)._references[0].referencedContext().toSpanId()).toEqual(rootSpan.context().toSpanId())
      expect((createdSpan as any)._references[0].referencedContext().toTraceId()).toEqual(
        rootSpan.context().toTraceId()
      )
    })

    it('References the fallbackSpan with provided referenceType if rootSpan is not provided', async () => {
      const { createdSpan, rootSpan } = await WrapperTester.runInstrumentedHandler(
        {
          ...wrapperTestConfig,
          useFallbackSpan: true,
        },
        { spanReferenceType: SpanReferenceTypes.FOLLOWS_FROM }
      )
      expect(rootSpan.operationName()).toEqual('fallback-span')
      expect((createdSpan as any)._references.length).toEqual(1)
      expect((createdSpan as any)._references[0].type()).toEqual(REFERENCE_FOLLOWS_FROM)
      expect((createdSpan as any)._references[0].referencedContext().toSpanId()).toEqual(rootSpan.context().toSpanId())
      expect((createdSpan as any)._references[0].referencedContext().toTraceId()).toEqual(
        rootSpan.context().toTraceId()
      )
    })

    it('Assigns the correct operation name', async () => {
      const { createdSpan } = await WrapperTester.runInstrumentedHandler(wrapperTestConfig, {
        instrumentationOptions: { operationName: 'my-op-name' },
      })
      expect(createdSpan?.operationName()).toEqual('my-op-name')
    })
  })

  if (expectedErrorMessage) {
    describe('Wrapper works properly when handler throws', () => {
      it('Injects the error on the created span', async () => {
        const { createdSpan } = await WrapperTester.runInstrumentedHandler(wrapperTestConfig)
        expect(createdSpan?.tags()[Tags.ERROR]).toEqual('true')
        const len = (createdSpan as any)._logs.length
        expect(len).toEqual(1)
        expect((createdSpan as any)._logs[0].fields.event).toEqual('error')
        expect((createdSpan as any)._logs[0].fields.error.message).toEqual(expectedErrorMessage)
      })

      it('Throws ErrorReport if throwErrorReport is true', async () => {
        const { error } = await WrapperTester.runInstrumentedHandler(wrapperTestConfig, {
          instrumentationOptions: { throwErrorReport: true },
        })
        expect(error).toBeInstanceOf(ErrorReport)
        expect(error.message).toEqual(expectedErrorMessage)
      })

      it('Throws original error if throwErrorReport is false', async () => {
        const { error } = await WrapperTester.runInstrumentedHandler(wrapperTestConfig, {
          instrumentationOptions: { throwErrorReport: false },
        })
        expect(error).not.toBeInstanceOf(ErrorReport)
        expect(error.message).toEqual(expectedErrorMessage)
      })
    })
  }
}
