import { expectTypeOf } from 'expect-type'
import {
  TracingContext,
  tracingInstrumentAsyncFn,
  TracingInstrumentationOptions,
  tracingInstrumentSyncFn,
} from '../wrappers'
import { registerWrapperTestSuite } from './wrappersTestSuite'

describe('tracingInstrumentSyncFn', () => {
  describe('Types testing', () => {
    it(`Doesn't accept async functions`, () => {
      const a = async (x: TracingContext, y: number) => 1
      // @ts-expect-error
      tracingInstrumentSyncFn(a, { operationName: 'test' })
    })

    it(`Doesn't accept Promise returning functions`, () => {
      const a = (x: TracingContext, y: number) => Promise.resolve(1)
      // @ts-expect-error
      tracingInstrumentSyncFn(a, { operationName: 'test' })
    })

    it('Accepts sync functions and returns a function with the same type', () => {
      const a = (x: TracingContext, y: number) => 1
      expectTypeOf(tracingInstrumentSyncFn(a, { operationName: 'test' })).toEqualTypeOf(a)
    })
  })

  describe('Checks for sync function with no arguments ', () => {
    const fn = (tracingCtx: TracingContext, ...args: any[]) => {
      expect(args.length).toEqual(0)
      return 2
    }

    registerWrapperTestSuite({
      wrapperTestConfig: {
        handlerType: 'sync',
        instrumentedHandlerCreator: (opts: TracingInstrumentationOptions) => tracingInstrumentSyncFn(fn, opts),
        args: [],
      },
      expects: {
        expectedReturnValue: 2,
      },
    })
  })

  describe('Checks for sync function with arguments', () => {
    const fn = (tracingCtx: TracingContext, ...args: any[]) => {
      expect(args.length).toEqual(2)
      expect(args[0]).toEqual(1)
      expect(args[1]).toEqual(2)
      return 10
    }

    registerWrapperTestSuite({
      wrapperTestConfig: {
        handlerType: 'sync',
        instrumentedHandlerCreator: (opts: TracingInstrumentationOptions) => tracingInstrumentSyncFn(fn, opts),
        args: [1, 2],
      },
      expects: {
        expectedReturnValue: 10,
      },
    })
  })

  describe('Checks for sync function throwing error', () => {
    const fn = (tracingCtx: TracingContext, ...args: any[]) => {
      expect(args.length).toEqual(0)
      throw new Error('mock-error')
    }

    registerWrapperTestSuite({
      wrapperTestConfig: {
        handlerType: 'sync',
        instrumentedHandlerCreator: (opts: TracingInstrumentationOptions) => tracingInstrumentSyncFn(fn, opts),
        args: [],
      },
      expects: {
        expectedErrorMessage: 'mock-error',
      },
    })
  })
})

describe('tracingInstrumentAsyncFn', () => {
  describe('Types testing', () => {
    it(`Doesn't accept sync functions`, () => {
      const a = (x: TracingContext, y: number) => 1
      // @ts-expect-error
      tracingInstrumentAsyncFn(a, { operationName: 'test' })
    })

    it('Accepts async functions and returns a function with the same type', () => {
      const a = async (x: TracingContext, y: number) => 1
      expectTypeOf(tracingInstrumentAsyncFn(a, { operationName: 'test' })).toEqualTypeOf(a)
    })

    it('Accepts functions returning a promise and returns a function with the same type', () => {
      const a = (x: TracingContext, y: number) => Promise.resolve(1)
      expectTypeOf(tracingInstrumentAsyncFn(a, { operationName: 'test' })).toEqualTypeOf(a)
    })
  })

  describe('Checks for async function with no arguments ', () => {
    const fn = async (obj: TracingContext, ...args: any[]) => {
      expect(args.length).toEqual(0)
      return 2
    }

    registerWrapperTestSuite({
      wrapperTestConfig: {
        handlerType: 'async',
        instrumentedHandlerCreator: (opts: TracingInstrumentationOptions) => tracingInstrumentAsyncFn(fn, opts),
        args: [],
      },
      expects: {
        expectedReturnValue: 2,
      },
    })
  })

  describe('Checks for async function with arguments', () => {
    const fn = async (obj: TracingContext, ...args: any[]) => {
      expect(args.length).toEqual(2)
      expect(args[0]).toEqual(1)
      expect(args[1]).toEqual(2)
      return 10
    }

    registerWrapperTestSuite({
      wrapperTestConfig: {
        handlerType: 'async',
        instrumentedHandlerCreator: (opts: TracingInstrumentationOptions) => tracingInstrumentAsyncFn(fn, opts),
        args: [1, 2],
      },
      expects: {
        expectedReturnValue: 10,
      },
    })
  })

  describe('Checks for async function throwing error', () => {
    const fn = async (obj: TracingContext, ...args: any[]) => {
      expect(args.length).toEqual(0)
      throw new Error('mock-error')
    }

    registerWrapperTestSuite({
      wrapperTestConfig: {
        handlerType: 'async',
        instrumentedHandlerCreator: (opts: TracingInstrumentationOptions) => tracingInstrumentAsyncFn(fn, opts),
        args: [],
      },
      expects: {
        expectedErrorMessage: 'mock-error',
      },
    })
  })
})
