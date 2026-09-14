/**
 * Label value reported for requests that never reached a named handler: unmatched
 * paths (Koa answers its default 404), requests rejected before the route pipeline
 * (replica-level rate limiter, errors in compress/recorder), and handlers that
 * don't set `ctx.requestHandlerName`.
 *
 * The value must be a non-empty string. `ctx.requestHandlerName` is `undefined`
 * for those requests, and Node's cluster IPC serializes each worker's registry as
 * JSON, which drops properties whose value is `undefined`. The sample then reaches
 * the aggregated `/metrics` with the `handler` label missing altogether, which
 * Prometheus reads as `handler=""` — a distinct, unnamed series that shows up as
 * an extra "Value" line in dashboards.
 *
 * `'undefined'` is deliberate rather than a nicer word: prom-client's local
 * exposition already rendered `handler: undefined` as `handler="undefined"` before
 * the cluster aggregation was introduced, so keeping that value makes the
 * aggregated output match the historical series identity and keeps existing
 * dashboards, filters and alerts (e.g. `handler!~"builtin:.*|undefined"`) working.
 */
export const UNNAMED_REQUEST_HANDLER = 'undefined'

/**
 * Resolves the `handler` label value for a request, falling back to
 * {@link UNNAMED_REQUEST_HANDLER} when the pipeline never named the handler.
 * Empty strings fall back too, so the label is never emitted empty.
 */
export const requestHandlerLabel = (requestHandlerName?: string): string =>
  requestHandlerName || UNNAMED_REQUEST_HANDLER
