import * as asyncHooks from 'async_hooks'

interface ReportingScope {
  getStore(): true | undefined
  run<R>(store: true, callback: () => R): R
}

// `AsyncLocalStorage` exists from Node 12.17 on. The typings this package builds with (`@types/node` 12.x)
// predate it, and on an older Node the scope is simply absent: reports are then written as before.
const AsyncLocalStorage: (new () => ReportingScope) | undefined = (asyncHooks as any).AsyncLocalStorage

const scope = AsyncLocalStorage && new AsyncLocalStorage()

/**
 * Whether the current asynchronous context was started by a logger while it was writing an error
 * report: a request the logger itself made, a retry of it, a timer it set.
 */
export const isReportingError = () => scope?.getStore() === true

/**
 * Runs `write`, marking everything asynchronous it starts as started by error reporting. Code that
 * runs after `write` returns, and requests that were already in flight, are not marked.
 */
export const whileReportingError = <R>(write: () => R): R => (scope ? scope.run(true, write) : write())
