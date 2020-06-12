# Distributed Tracing

**Distributed Tracing is only available internally**

`@vtex/api` provides out-of-the-box distributed tracing instrumentation. For more
information on how to use it or how to instrument your app with more granularity
check the [VTEX IO Tracing Guide](https://github.com/vtex/vtex-io-tracing-guide)

This documentation will approach details on the native instrumentation provided and helpers
exported to help you to instrument your app.

## Span Tags

All Tags exported for your manual instrumentation or used by the native
instrumentation are available and documented in [this file](./src/tracing/Tags.ts).

Note that the tags specified in the [OpenTracing Semantic Convention](https://github.com/opentracing/specification/blob/master/semantic_conventions.md)
are reexported in this file - the documentation for these tags is available in the
[this link](https://github.com/opentracing/specification/blob/master/semantic_conventions.md).

## Native instrumentation

### Entrypoint Span

The native instrumentation creates a entrypoint span for each incoming request
of the app - the span will start first thing when the request was processed by
Koa and will finish when all user middlewares finished (there's work to change
this for the span to finish when the request/response finished streaming).

The entrypoint span has tags assigned related to the incoming request (more details
on the meaning of each tag on ):

- span.kind
- http.url
- http.method
- http.path
- http.status_code
- vtex.request_id
- vtex.incoming.workspace
- vtex.incoming.account

This span may have an error associated with it, so it can have additional error tags
and logs.

Also, the entrypoint span logs the incoming request headers and the outgoing response
headers.

### Process Tags

The additional process tags created by the native instrumentation are:

- app.linked
- app.node_vtex_api_version
- app.production
- app.region
- app.version
- app.workspace
- app.node_env

### Client HTTP(S) calls

Every IOClient http(s) request is natively instrumented with tracing. The span
represents the entire duration of the request, except when request is streaming,
in this case the span is finished when the underlying http client implementation
finished preparing the incoming data stream.

The tags associated with a request span are:

- span.kind
- http.method
- http.url
- http.retry_count

Optionally there can be:

- http.status_code
- http.router_cache

And in case of client error, like timeouts:

- http.no_response

This span may have an error associated with it, so it can have additional error tags
and logs.

Every request span logs the outgoing request headers and incoming response headers.

## Manual Instrumentation

If you want to have a more granular view on the traces involving your app, you can do
a manual, more granular, instrumentation for distributed tracing.

All middlewares provide a `tracer` field on the `IOContext` provided, with which you
can create spans for your manual instrumentation. The `tracer` object is a wrapper for
the `OpenTracing` tracer, and it's implemented [here](src/tracing/UserLandTracer.ts).

For a detailed tutorial on how to instrument your app read the docs on [VTEX IO Distributed Tracing Guide](https://github.com/vtex/vtex-io-tracing-guide).

### Function Wrappers

When instrumenting an app it's very common to wrap an important function in a Span representing
this operation, so we created helpers for instrumenting a function with tracing. These are:

- `tracingInstrumentSyncFn(fn, options)`: Instrument a **sync** function with tracing.
- `tracingInstrumentAsyncFn(fn, options)`: Instrument an **async** function or a function that returns a promise with tracing.

The options you can pass to them are documented in the `TracingInstrumentationOptions` interface,
defined [here](src/tracing/instrumentationHelpers/wrappers.ts).

The function to be instrumented has to be adapted to receive as first argument a `TracingContext`, which
can be extended if you want. Your function will be called with this object carrying the tracing context created by the wrapper (it will create a `currentSpan` for your function -- you can access it and assign tags and logs
you want).

```ts
import { TracingContext, tracingInstrumentSyncFn } from '@vtex/api'

interface rawFooInput extends TracingContext {
  arg1: number
}

const rawFoo = (obj: rawFooInput, arg2: number) => {
  // The currentSpan will be created by the wrapper function
  obj.tracingCtx.currentSpan.log({ event: 'inside-foo' })
  return 123
}

const instrumentedFoo = tracingInstrumentSyncFn(rawFoo, { operationName: 'foo' })

const instrumentedBar = tracingInstrument(
  (obj: TracingContext) => {
    const { tracer, currentSpan } = obj.tracingCtx

    // do some things
    // ...

    // The tracingCtx passed to instrumentedFoo will use
    // currentSpan as root to the new span to be created
    instrumentedFoo({ arg1: 1, tracingCtx: { tracer, currentSpan }, 2)
  },
  { operationName: 'bar' }
)

async function middlewareWololo(ctx: ServiceContext<Clients>) {
  // It's not always necessary to pass a currentSpan
  // If no currentSpan is passed the parent used will
  // be the fallbackSpan configured on ctx.vtex.tracer
  instrumentedBar({ tracingCtx: { tracer: ctx.vtex.tracer } })
}
```

There's a subtle difference on the first argument for the instrumented function and
the original function. The original function expects `TracingContext` or an extension
of it as first argument. The instrumented function will expect the same, except for one difference:
the `tracingCtx.currentSpan` is optional on the argument for the instrumented function, meaning
that you don't have to pass a parent span, and the same field is mandatory on the original function
argument, meaning that the wrapper **will** provide a `currentSpan` for you function call.
