# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [6.36.3] - 2020-09-09
### Changed
- Allow sending events to any resource

## [6.36.2] - 2020-08-19
### Fixed
- Set wait time to force shutdown workers based on service timeout
- Stop removing response from error.
- Update @vtex/node-error-report to remove sensitive information from errors logged to splunk and to distributed tracing.
- Remove sensitive information from headers before logging onto tracing spans.

## [6.36.1] - 2020-08-17
### Fixed
- Remove sensitive exception data before responding to browser.

## [6.36.0] - 2020-07-30
### Added
- [metric] Created new Prometheus metrics related to Event Loop Lag between scrapes:
  - runtime_event_loop_lag_max_between_scrapes_seconds
  - runtime_event_loop_lag_percentiles_between_scrapes_seconds

## [6.35.2] - 2020-07-24
### Added
- `timestamp` field to VTEX IO Billing log.

## [6.35.1] - 2020-07-22
### Added
- [metrics] Export jaeger metrics.

### Fixed
- [metrics] Typo on event listened to increment `runtime_http_aborted_requests_total`.
- [tracing:entrypoint] Fix waiting for response stream to finish.

## [6.35.0] - 2020-07-08
### Added
- [metrics] Create new Prometheus exported metrics:
  - runtime_http_requests_total
  - runtime_http_aborted_requests_total
  - runtime_http_requests_duration_milliseconds
  - runtime_http_response_size_bytes
- [tracing] Finish entrypoint span when response finishes streaming.

### Changed
- Update `billingOptions` type.

## [6.34.0] - 2020-07-03
### Fixed
- Remove fallback to x-vtex-credential as adminUserAuthToken.
### Added
- Send workspace to session service.
- Add channelPrivacy to SegmentData type.

## [6.33.0] - 2020-06-25
### Added
- [clients:tracing] Create span wrapping HttpClient middlewares with information on caching and retries.

## [6.32.0] - 2020-06-25
### Changed
- [tracing] Remove span wrapping user middlewares.
- [tracing] Add entrypoint span tags and logs after the execution of middlewares.
- [ErrorReport] Do not allow creating recursive ErrorReports.

## [6.31.1] - 2020-06-05
### Fixed
- Release the 6.31.0 again due to issues.

## [6.31.0] - 2020-06-04
### Added
- Add `putRaw` method on HttpClient.
- Support to `If-Match` header usage on VBase client.

### Changed
- [ErrorReport] Log ErrorReport errors created on `HttpClient` requests or thrown by user handlers to splunk.
- [ErrorReport] Add error metadata on span logs instead of on span tags.
- [tracing:entrypoint] Log incoming request headers and outgoing response headers.
- [tracing] Use remote sampling.

### Fixed
- [tracing:entrypoint] Fix URL tag on entrypoint span - use `ctx.request.href` instead of `ctx.request.originalUrl`.
- Masterdata sort typing and scroll pagination.

## [6.30.1] - 2020-05-21
### Changed
- Remove `serverTiming` metrics from client headers.
- Add `serverTiming` metrics on error report.

## [6.30.0] - 2020-05-20

### Added
- Masterdata client

## [6.29.0] - 2020-05-18
### Changed
- Create an option to disable conditional segment/session vary
- Set vary: x-vtex-session if the scope is private

## [6.28.3] - 2020-05-15
### Fixed
- [ErrorReport] Update `@vtex/node-error-report` package:
  - Clone objects before sanitizing them.

## [6.28.2] - 2020-05-13
### Changed
- [ErrorReport] Use `@vtex/node-error-report` package.

## [6.28.1] - 2020-05-05
### Fixed
- [tracing:logger] Make Logger serializable again.

## [6.28.0] - 2020-05-04
### Changed
- [tracing:init] Increase sampling rate to 5%.
- [ErrorReport] Serialize buffer only as a `byteCount` and a `type: buffer`.
- [ErrorReport] Increase ErrorReport serialization depth from 6 to 8.

### Added
- [tracing:entrypoint-span] Add `vtex.request_id` tag.
- [ErrorReport] Add `error.server.code`, `error.server.source`, `error.server.request_id` to tags added to error spans.
- [response:headers] Add `x-trace-id` when request is traced.
- [logger] Log `trace-id` when request is traced.
- [tracing:tags] Use snake case to conform with OpenTracing.


## [6.27.0] - 2020-04-28

## [6.26.2-beta] - 2020-04-28

## [6.26.1-beta] - 2020-04-27

## [6.25.1-beta] - 2020-04-27
### Added
- Settings from settings builder to events.

## [6.26.0] - 2020-04-22
### Changed
- Tracing utilities export.

### Added
- `NODE_ENV` tag to process tracing tags.
- `tracingConfig` argument to all clients request functions.
- Option on request spans to define if request is childOf rootSpan or followsFrom it.
- Option on request span to add suffix on request span name - it will be `http-request:suffx`.
- Helper `createTracingContextFromCarrier` to allow worker threads and child processes to be traced.

## [6.25.0] - 2020-04-15
### Added
- Extensions field to graphql client.

## [6.24.4] - 2020-04-08
### Fixed
- Adds missing `@` in BillingMetrics client

## [6.24.3] - 2020-04-01
### Fixed
- [tracing] Fix `ErrorReport` object strings truncating (StackOverflow error in some cases).
- [tracing] Make `ctx.vtex.tracer` a required field on `IOContext`.

### Added
- [tracing] Add `fallbackSpanContext` method to `UserLandTracer`.

## [6.24.2] - 2020-03-31
- Workspaces sharing apps metainfo.

## [6.24.1] - 2020-03-31
- Bump version.

## [6.24.0] - 2020-03-31
## Changed
- Send events using `Courier` instead of `Colossus`.

## [6.23.1] - 2020-03-26
### Fixed
- Trace only 1% of the requests.

## [6.23.0] - 2020-03-26
### Added
- Tracing instrumentation.

## [6.22.0] - 2020-03-20
### Changed
- Updated `Billing Options` types

### Added
- Apps' Install API response type
- Skidder topic names on logs are not based on account anymore

### Fixed
- Fixed params for VBase list

## [6.21.0] - 2020-03-05
### Added
- createHttpsAgent helper function so devs can import it in their apps and use our agent
- httpsAgent added to instanceOptions so we can add the agent in the client's constructor

### Removed
- Https interceptor agent

## [6.20.0] - 2020-03-04
### Added
- Support for a external schema to be passed into graphql Service configuration.

## [6.19.0] - 2020-03-02
### Added
- Get `adminUserAuthToken` from header `X-Vtex-Credential`.

## [6.18.0] - 2020-02-27
### Added
- Adds stale while revalidating to apps get meta infos function

## [6.17.0] - 2020-02-18
### Added
- Injects `__SKIDDER_TOPIC_1` and `__SKIDDER_TOPIC_2` keys in logs

## [6.16.1] - 2020-02-17
### Changed
- Exponential timeout and backoff variables can now be set by request and not only by client.
### Fixed
- Fix revalidation for cached buffer responses.

## [6.16.0] - 2020-02-13
### Changed
- Removes slowRecorder from code

## [6.15.2] - 2020-02-13

### Added

- Payment Provider client

## [6.15.1] - 2020-02-10
### Fixed
- Fix `x-vtex-etag-control` set by SmartCacheDirective.

## [6.15.0] - 2020-02-06
### Added
- Add support for router binding header.

## [6.14.0] - 2020-02-06

## [6.13.1] - 2020-02-04
### Fixed
- Adds catalog Graphql client to IOClients

## [6.13.0] - 2020-02-03

## [6.12.1] - 2020-02-03
### Changed
- Make it usable outside of IO

## [6.12.0] - 2020-01-31
### Added
- Adds `catalogGraphQL` client

## [6.11.1] - 2020-01-30
### Fixed
- Export tenant data

## [6.11.0] - 2020-01-30
### Changed
- Update axios from 0.18.0 to 0.19.2

## [6.10.1] - 2020-01-29
### Fixed
- getAppsMetaInfos typings from Apps client

## [6.10.0] - 2020-01-29
### Changed
- Improve `cacheKey` performance and sort params in the key.

## [6.9.0] - 2020-01-29
### Added
- Adds new query to messages client
- Uses new resolver in Translatable resolver

## [6.8.1] - 2020-01-28
### Chore
- Increase query size limit from 1mb to 3mb.
### Fixed
- Settings format is now the same delivered by settings server.

## [6.8.0] - 2020-01-23
### Added
- New settings middleware.
- New directive in graphql for declaring route settings type.

## [6.7.1] - 2020-01-22
### Fixed
- Encodes Buffer with base64 to cache it correctly

## [6.7.0] - 2020-01-22
### Added
- `@deprecated` directive logs to Splunk when used. To avoid overflowing splunk with useless logs, we only log once at every minute

## [6.6.2] - 2020-01-16
### Added
- Parameters to customize exponential backoff delay and increase timeout at each retry.

### Changed
- Stop using `axios-retry` logic, implement retry manually.

## [6.6.1] - 2020-01-16
### Fixed
- Vbase `getJSON` typings. Do not return type `{}`

### Changed
- Do not rely on state for flushing `x-vtex-meta` headers

## [6.6.0] - 2020-01-16

## [6.6.0-beta] - 2020-01-15
### Changed
- Enables fast recorder

## [6.5.0] - 2020-01-15
### Changed
- Sets `x-vtex-meta` header *ONCE* in the `recorder` middleware to tackle performance issues

## [6.4.1] - 2020-01-09
### Fixed
- Internal app path log in toolbelt

## [6.4.0] - 2020-01-09
### Added
- Allow getting segment data with default locale and currency from binding instead of tenant.

## [6.3.0] - 2020-01-08
### Added
- New route to get files from Apps with only the app name, account and workspace

## [6.2.2] - 2020-01-08
### Fixed
- Logic to get cancellable methods for cancellation token

## [6.2.1] - 2020-01-08
### Fixed
- There was a HUGE performance drop when setting `x-vtex-meta` header via `ctx.set` using an array. Joining in a single string solved the problem

## [6.2.0] - 2020-01-07
### Added
- Batches messages to be translated

## [6.1.7] - 2020-01-02
### Changed
- Added correct getFile function to Assets client

## [6.1.6] - 2019-12-17
### Changed
- When linking only one worker will be available
- Gracefull shutdown when receiving `sigterm` from master and child processes

### Fixed
- Remote debugger now debugs worker instead of master process
- @transltableV2 directive arguments

## [6.1.5] - 2019-12-12

## [6.1.4] - 2019-12-12
### Fixed
- Add binding to context when receiving header

## [6.1.3] - 2019-12-11
### Fixed
- Public routes now working

## [6.1.2] - 2019-12-11

## [6.1.1] - 2019-12-10

## [6.1.0] - 2019-12-09

## [6.0.0] - 2019-11-27

## [6.0.0-beta.12] - 2019-11-26

## [3.66.3] - 2019-11-26
### Removed
- Splunk log in clients to console.log only

## [3.66.2] - 2019-11-26
### Fixed
- Flag `fireEvent` in Messages `saveV2` should be optional

## [3.66.1] - 2019-11-25
### Fixed
- Checks if logger.warn is a function before calling it

## [3.66.0] - 2019-11-25
### Added
- Add binding information to HttpClient requests

## [3.65.4] - 2019-11-25
### Fixed
- Conflicts Resolver only use `comparableKeys` when objects owns them

## [3.65.3] - 2019-11-25
## Added
- Allows filter dependencies from app list

## [3.65.2] - 2019-11-25
### Added
- New attribute to messages API

## [3.65.1] - 2019-11-21

## [3.65.1-beta] - 2019-11-21
### Fixed
- Uses http in old routes

## [3.65.0] - 2019-11-21
### Added
- Error type `TooManyRequestsError` that returns status code 429

## [3.64.0] - 2019-11-19
### Added
- Uses https if request is from outside IO
### Changed
- Updates internal routing

## [3.63.0] - 2019-11-18
### Added
- Update Messages SaveArgsV2 interface

## [3.62.6] - 2019-11-14
### Fixed
- Removes `ctx.graphql` object sharing and make it have a request cycle duration

## [3.62.5] - 2019-11-11
### Changed
- Upgrades new error query format for splunk 72

### Fixed
- Fix "socket hang up" by preventing client request abortion after server response is finished or client response is completed.
- Fix cancellation error not being thrown if the request does not have metric.

## [3.62.4] - 2019-11-04
### Changed
- Removes tracing from graphqlruntime

## [3.62.3] - 2019-10-30
### Fixed
- stale getAppFile accepts MAJOR.x app name

## [3.62.2] - 2019-10-30
### Fixed
- Handle nullable nested objects in MineWinsConflictsResolver

## [3.62.1] - 2019-10-29
### Fixed
- Export error type RequestCancelledError in index

## [3.62.0] - 2019-10-29
### Added
- New scalar type and directive to sanitize strings

### Fixed
- Handle error without response in VBase getJSON calls

## [3.61.1] - 2019-10-29
### Fixed
- Throw error in `getAppsMetaInfos` method if `staleIfError`` is false.

## [3.60.0] - 2019-10-28

## [3.59.2] - 2019-10-24
### Fixed
- Handle nullable arrays passed to MineWinsConflictsResolver

## [3.59.1] - 2019-10-18
### Fixed
- Correctly handle errors caused by requests cancelled with cancellation token

## [3.59.0] - 2019-10-16

## [3.58.0] - 2019-10-14
### Added
- **environment** arg to `JanusClient`.

## [3.57.1] - 2019-10-11
## Added
- Apps install accepts `infra:service-*` apps

## [3.56.0] - 2019-10-10
### Added
- New getAppMetaInfos function with diskCache fallback
- Add MineWinsConflict resolver logic to VBase client
- New getAppFiles with fallback strategies

## [3.55.4-beta] - 2019-10-09

## [3.55.3] - 2019-10-09
### Fixed
- Messages Save v2 interface


## [3.55.2] - 2019-10-01
### Fixed
- Warnings logged as errors

## [3.55.1] - 2019-09-27

## [3.55.0] - 2019-09-25

## [3.54.1] - 2019-09-23
### Added
- Tenant client added

## [3.54.0] - 2019-09-23
### Changed
- Logger client instantiated in service-node
- `@translatableV2` directive uses language from context instead of making an IO

## [3.53.0] - 2019-09-16
### Changed
- TranslatableV2 support for context and from in message encoding

### Changed
- Resolve context in message at directive translatableV2

## [3.52.0] - 2019-09-16

### Added
- Add saveV2 method in MessagesGraphQL client

## [3.51.1] - 2019-09-13
### Fixed
- Add host to IOContext

## [3.51.0] - 2019-09-13
### Added
- Forward x-forwarded-host header.
- Add vary x-forwarded-host.

## [3.50.2] - 2019-09-13

## [3.50.2-beta] - 2019-09-12
### Added
- Add `platform` to `ctx`

## [3.50.1] - 2019-09-11

## [3.50.0] - 2019-09-11

## [3.50.0-beta] - 2019-09-11
### Added
- Export list of all available public domains

## [3.49.0] - 2019-09-10

## [3.48.3] - 2019-09-09

### Fixed
- Added logger middleware to events pipeline.

## [3.48.2] - 2019-09-04

## [3.48.1] - 2019-09-04

## [3.48.1-beta.0] - 2019-09-04

## [3.48.1-beta] - 2019-09-03

## [3.48.0] - 2019-09-03
### Added
- Route for testing apps on `builder-hub`.

## [3.47.2] - 2019-09-02

### Fixed
- Update missing changelog.
- Remove if statements on existence of ctx.vtex.logger

## [3.47.1] - 2019-08-29
### Fixed
- Fix ramda typings errors.

## [3.47.0] - 2019-08-29
### Added
- Add parameter `skipSemVerEnsure` in app publish.

## [3.46.0] - 2019-08-26
### Added
- Create event handler similar to http requests, providing vtex clients, timings  and error logs.

## [3.46.0-beta.2] - 2019-08-26

## [3.46.0-beta.1] - 2019-08-26

## [3.46.0-beta.0] - 2019-08-26

## [3.46.0-beta] - 2019-08-26

## [3.45.0] - 2019-08-22

## [3.44.3] - 2019-08-20
### Fixed
- Stop ignoring 0ms metrics.
- Rename GraphQL middlewares to resolve metrics conflict.

### Changed
- Stop measuring event-loop overhead.

## [3.44.2] - 2019-08-19

## [3.44.1] - 2019-08-19
### Fixed
- Truncate long GraphQL errors so they can be sent to Splunk.

## [3.44.0] - 2019-08-19

### Changed
- Deprecate Colossus logger completely, using stdout instead.

## [3.43.0] - 2019-08-19

### Changed

- Properly times metrics, considering total elapsed and code run after `await next()`.
- Avoid broken metrics when a middleware throws.
- Do not batch metrics for unsuccessful handlers and middlewares.
- Rename `http-handler-success-*` to `http-handler-*` and only count non-success statuses.

## [3.42.0] - 2019-08-19

### Changed

- Disable caching if response varies with session. (Before, we incorrectly disabled caching if _we had a session token_)

## [3.41.1] - 2019-08-15

## [3.41.1-beta] - 2019-08-15

## [3.41.0] - 2019-08-13

## [3.40.1] - 2019-08-12

### Fixed

- Typo on segment path.

## [3.40.0] - 2019-08-09

## [3.39.0] - 2019-08-09

## [3.38.0] - 2019-08-08
### Added
- Inside the class `Translatable`, allow `string` arrays to be translated too.

## [3.37.2] - 2019-08-08

## [3.37.1] - 2019-08-08

## [3.37.0] - 2019-08-08

## [3.36.1] - 2019-08-08

## [3.36.0] - 2019-08-08

## [3.35.0] - 2019-08-01
### Fixed
- Use POST requests for queries only in the `MessagesGraphQL` client, not in the `GraphQLClient`.

## [3.34.1] - 2019-07-31

## [3.34.0] - 2019-07-30

### Fixed
- Create middleware that deletes headers passed to make cache behavior consistent regarldess of CDN.

## [3.33.1] - 2019-07-29
### Changed
- `getAccountData` now requires to pass the param `VtexIdclientAutCookie`.

## [3.33.0] - 2019-07-26

## [3.32.2] - 2019-07-24
### Added
- Accept `VtexIdclientAutCookie` as param to `getAccountData`.

## [3.32.1] - 2019-07-23
### Fixed
- Revert changes made in release 3.31.0.

## [3.32.0] - 2019-07-22
### Added
- Function to check resource access in License Manager Client

## [3.31.0] - 2019-07-15
### Changed
- Do not separate messages `translate` queries in batches. Instead, use a single POST request for all translations.

## [3.30.2] - 2019-07-10

## [3.30.1] - 2019-07-10

## [3.30.0] - 2019-07-09

## [3.29.1] - 2019-07-09

## [3.29.0] - 2019-07-09

## [3.28.1] - 2019-07-08

## [3.28.0] - 2019-07-08

## [3.27.2] - 2019-07-08

## [3.27.1] - 2019-07-02
### Added
- Http head request
- VBase get file metadata

## [3.27.0] - 2019-06-27

## [3.26.5] - 2019-06-27

## [3.26.4] - 2019-06-27
### Fixed
- Removal of circular references in logs.

## [3.26.3] - 2019-06-24

## [3.26.2] - 2019-06-24

## [3.26.1] - 2019-06-21
### Fixed
- Problem with `recorder` inside `context` - Assure that `recorder` is inside `context` at the right moment.

## [3.26.0] - 2019-06-19

## [3.25.0] - 2019-06-19

## [3.24.1] - 2019-06-17
### Fixed
- Fixes `Please use a named function as handler for better metrics` warnings

## [3.24.0] - 2019-06-14

## [3.24.0-beta.0] - 2019-06-13

## [3.24.0-beta] - 2019-06-13
### Added
- Propagate `x-vtex-session` across requests.

## [3.23.0] - 2019-06-13
### Added
-  Enable environment selection, e.g beta, when cookie `vtex-commerce-env` is set

## [3.22.0] - 2019-06-06
### Added
- Typings for Free and Paid Billing Options
- Typings for Fixed and Metric-Based Calculation Items
- Type guards for Billing Options

## [3.21.3] - 2019-06-04

## [3.21.2] - 2019-05-27

## [3.21.1] - 2019-05-27

## [3.21.0] - 2019-05-27

## [3.20.0] - 2019-05-27

## [3.20.0-beta] - 2019-05-25

## [3.19.0] - 2019-05-24

## [3.18.2] - 2019-05-23

## [3.18.1] - 2019-05-21

## [3.18.0] - 2019-05-20
### Added
- Generate `manifest.json` schema from TypeScript definition.

## [3.17.0] - 2019-05-20
### Added
- GraphQL Client

## [3.16.0] - 2019-05-17

## [3.15.1] - 2019-05-17

### Changed
- Change type of `buildFeatures` to `Record<string, string[]>`

## [3.15.0] - 2019-05-13

## [3.14.1] - 2019-05-10

## [3.14.1-beta] - 2019-05-09

## [3.14.0] - 2019-05-09

## [3.13.1] - 2019-05-09

## [3.13.0] - 2019-05-08

### Changed
- Made query string param serialization `repeat` by default. This means arrays, which were previously encoded as e.g. `files[]=a&files[]=b` become `files=a&files=b`.

### Added
- Implement Settings client for `vtex.settings-server`.

## [3.12.1] - 2019-05-08

## [3.12.0] - 2019-05-07

### Added
- Add "buildFeatures" inside "manifest".

## [3.11.0] - 2019-05-06

## [3.10.0] - 2019-05-06

### Changed
- Add caller, params and query to error logs
- Relax error typing and capture stack automatically

## [3.9.2] - 2019-05-02
### Fixed
- Usage of `routes.Links` function in the `routes.Unlink` function (Apps client)

## [3.9.1] - 2019-05-02

## [3.9.0] - 2019-04-30

## [3.8.2-beta] - 2019-04-30

## [3.8.1] - 2019-04-26

## [3.8.0] - 2019-04-26

### Changed
- Add `adminUserAuthToken` (from cookie `VtexIdclientAutCookie`) and `storeUserAuthToken` (from cookie `VtexIdclientAutCookie_${account}`) to `ctx.vtex`

## [3.7.0] - 2019-04-25

### Changed
- Add LicenseManager client
- Add Session client
- Restructure HttpClient
- Implement IOClient
- Implement IOClient subclasses
- Port all native clients
- Reduced default timeout to 1s
- Added default `params` to HttpClient

## [3.6.1] - 2019-04-24

## [3.6.0] - 2019-04-24

## [3.5.2-beta] - 2019-04-24

## [3.5.1] - 2019-04-23

## [3.5.0] - 2019-04-22

### Added
- Add native error and warning classes and log these appropriately.

## [3.4.4] - 2019-04-22

## [3.4.4-beta] - 2019-04-19
### Changed
- Fixed host reference for Billing metrics sending

## [3.4.3] - 2019-04-18

## [3.4.2] - 2019-04-18

## [3.4.1] - 2019-04-18

## [3.4.0] - 2019-04-18

## [3.3.1] - 2019-04-16

## [3.3.1-beta.1] - 2019-04-17

## [3.3.1-beta.0] - 2019-04-17

## [3.3.1-beta] - 2019-04-15

## [3.3.0] - 2019-04-11
### Added
- Messages `saveTransalation` method

## [3.2.4] - 2019-04-10

## [3.2.3] - 2019-04-10

## [3.2.2] - 2019-04-09

## [3.2.1] - 2019-04-09
### Fixed
- Security hole as `Authorization`, `Proxy-Authorization` and `vtexIdClientAutCookie` headers were being sent to graphql errors

## [3.2.0] - 2019-04-09

## [3.2.0-beta.7] - 2019-04-09

## [3.2.0-beta.6] - 2019-04-09

## [3.2.0-beta.5] - 2019-04-09

## [3.2.0-beta.4] - 2019-04-08

## [3.2.0-beta.3] - 2019-04-08

### Added
- `segment.getSegment` and `segment.getSegmentByToken`

## [3.2.0-beta.2] - 2019-04-08

## [3.2.0-beta.1] - 2019-04-08

## [3.2.0-beta.0] - 2019-04-08

## [3.2.0-beta] - 2019-04-08

### Added
- Option `forceMaxAge` option to `HttpClient` request config. This allows certain requests to forceably be cached for `forceMaxAge` seconds, regardless of the responses' `Cache-control` header, as long as status is 200.

## [3.1.2] - 2019-04-09
### Changed
- Makes errors compliant to [apollo's specification](https://www.apollographql.com/docs/apollo-server/features/errors)
- Makes it possible to use graphql handler with a scary warning

## [3.1.2-beta.0] - 2019-04-08

## [3.1.2-beta] - 2019-04-08

## [3.1.0] - 2019-04-04

## [3.1.0-beta.0] - 2019-04-04

## [3.1.0-beta] - 2019-04-04

## [3.0.16] - 2019-04-04

## [3.0.16-beta.0] - 2019-04-04

## [3.0.16-beta] - 2019-04-04

## [3.0.15] - 2019-04-03

### Changed

- Added type inference for `IOClients.getOrSet` method. No need to type instantiations like

```ts
export class IOClients {
  public get logger(): Logger {
    return this.getOrSet('logger', Logger)
  }
}
```

You can just do

```ts
export class IOClients {
  public get logger() {
    return this.getOrSet('logger', Logger)
  }
}
```

instead

## [3.0.14] - 2019-04-03

## [3.0.14-beta.0] - 2019-04-03

## [3.0.14-beta] - 2019-04-03

## [3.0.13] - 2019-04-03

## [3.0.12] - 2019-04-02

## [3.0.11] - 2019-03-31

## [3.0.11-beta.7] - 2019-03-29

## [3.0.11-beta.6] - 2019-03-29

## [3.0.11-beta.5] - 2019-03-29

## [3.0.11-beta.4] - 2019-03-29

## [3.0.11-beta.3] - 2019-03-29

## [3.0.11-beta.2] - 2019-03-29

## [3.0.11-beta.1] - 2019-03-29

## [3.0.11-beta.0] - 2019-03-29

## [3.0.11-beta] - 2019-03-29

## [3.0.10] - 2019-03-28

## [3.0.9] - 2019-03-28

### Changed
- Expose more details on all errors (e.g. operationId, requestId, query source, variables).

## [3.0.9-beta.4] - 2019-03-28

## [3.0.9-beta.3] - 2019-03-28

## [3.0.9-beta.2] - 2019-03-28

## [3.0.9-beta.1] - 2019-03-28

## [3.0.9-beta.0] - 2019-03-28

## [3.0.9-beta] - 2019-03-28

## [3.0.8] - 2019-03-28

## [3.0.8-beta] - 2019-03-28

### Changed
- Conflate 2xx and 5xx status labels to success and error respectively.
- Adds `graphql-operation` metric that considers if _any_ resolver had errors, with two dimensions: success and error
- Logs each resolver error individually and add request information
- Stop logging successful route handlers
- Add single hardcoded retry for sending error logs
- Prepare for `graphql` route id (deprecating `__graphql`)
- Disallow declaration of `graphql` as http route handler

## [3.0.7-beta.0] - 2019-03-28

## [3.0.7] - 2019-03-28
### Added
- tsErrorsAsWarnings parameter for the `linkApp` and `relinkApp` methods of the `Builder` class

## [3.0.7-beta] - 2019-03-28

## [3.0.6] - 2019-03-28

## [3.0.5] - 2019-03-27

## [3.0.4] - 2019-03-27

## [3.0.3] - 2019-03-27

### Added
- Implement new Service() wrapper and port graphql route generation from service-runtime-node.

## [3.0.3-beta.4] - 2019-03-27

## [3.0.3-beta.3] - 2019-03-27

## [3.0.3-beta.2] - 2019-03-27

## [3.0.3-beta.1] - 2019-03-26

## [3.0.3-beta.0] - 2019-03-26

## [3.0.1-beta.28] - 2019-03-26

## [3.0.1-beta.27] - 2019-03-26

## [3.0.1-beta.26] - 2019-03-26

## [3.0.1-beta.25] - 2019-03-26

## [3.0.1-beta.24] - 2019-03-26

## [3.0.1-beta.23] - 2019-03-26

## [3.0.1-beta.22] - 2019-03-26

## [3.0.1-beta.21] - 2019-03-26

## [3.0.1-beta.20] - 2019-03-25

## [3.0.1-beta.19] - 2019-03-25

## [3.0.1-beta.18] - 2019-03-25

## [3.0.1-beta.17] - 2019-03-21

## [3.0.1-beta.16] - 2019-03-21

## [3.0.1-beta.15] - 2019-03-21

## [3.0.1-beta.14] - 2019-03-21

## [3.0.1-beta.13] - 2019-03-20

## [3.0.1-beta.12] - 2019-03-20

## [3.0.1-beta.11] - 2019-03-20

## [3.0.0-beta.16] - 2019-03-20

## [3.0.0-beta.15] - 2019-03-20

## [3.0.0-beta.14] - 2019-03-20

## [3.0.0-beta.13] - 2019-03-20

## [3.0.0-beta.12] - 2019-03-20

## [3.0.0-beta.11] - 2019-03-20

## [3.0.0-beta.10] - 2019-03-19

## [3.0.0-beta.9] - 2019-03-19

## [3.0.0-beta.8] - 2019-03-18

## [3.0.0-beta.7] - 2019-03-18

## [3.0.0-beta.6] - 2019-03-18

## [3.0.0-beta.5] - 2019-03-18

## [3.0.0-beta.4] - 2019-03-17

## [3.0.0-beta.3] - 2019-03-17

## [3.0.0-beta.2] - 2019-03-17

## [3.0.0-beta.1] - 2019-03-17

## [3.0.0-beta.0] - 2019-03-17

## [3.0.0-beta] - 2019-03-17

## [2.4.0] - 2019-03-16

## [2.3.6] - 2019-03-16

## [2.3.6-beta] - 2019-03-16

## [2.3.5] - 2019-03-14

## [2.3.4] - 2019-03-14

### Changed
- Add production dimension to all metrics

## [2.3.3] - 2019-03-13

## [2.3.2] - 2019-03-13

## [2.3.1] - 2019-03-13

## [2.3.0] - 2019-03-13

## [2.3.0-beta.3] - 2019-03-13

## [2.3.0-beta.2] - 2019-03-13

## [2.3.0-beta.1] - 2019-03-13

## [2.3.0-beta.0] - 2019-03-13

## [2.3.0-beta] - 2019-03-13

### Changed
- Remove production from MetricsAccumulator methods and add cacheHits

## [2.2.0] - 2019-03-12

## [2.2.0-beta.0] - 2019-03-11

## [2.2.0-beta] - 2019-03-11

### Changed
- Only retry safe requests
- Add metrics for proxy timeout and retries
- Add `metric` config to clients requests
- Add `concurrency` option to HttpClient to limit amount of parallel requests

## [2.1.0] - 2019-03-07

### Changed
- Change default retry behaviour to only retry on network error once
- Accept retryConfig on each HttpClient

## [2.1.0-beta.1] - 2019-02-28

## [2.1.0-beta.0] - 2019-02-27

## [2.1.0-beta] - 2019-02-27
### Changed
- Added new required parameter to create a new workspace on Workspaces API.

## [1.9.0] - 2019-02-25
### Added
- Functions that call new Apps API for dependency resolution.

## [1.8.3] - 2019-02-22
### Changed
- Updated App Manifest types

## [1.8.2] - 2019-02-22

## [1.8.2-beta] - 2019-02-22

## [1.8.1] - 2019-02-13

## [1.8.1-beta] - 2019-02-12

## [1.8.0-beta] - 2019-02-12

## [1.7.0] - 2019-02-12
### Added
- segmentToken and sessionToken to IOContext type definition

## [1.7.0-beta] - 2019-02-12

## [1.6.0] - 2019-01-25

## [1.5.4] - 2019-01-17
### Added
- protected context in favor of private one in IODataSource

## [1.5.3] - 2019-01-11
### Fixed
- IOContext types mismatch with service-runtime-node

## [1.5.2] - 2018-11-27

## [1.5.1] - 2018-10-31

## [1.5.0] - 2018-10-31

## [1.4.0] - 2018-10-29

## [1.2.0] - 2018-10-16

## [1.1.0] - 2018-10-15

## [1.0.0] - 2018-10-08

## [1.0.0-beta.16] - 2018-10-08

## [1.0.0-beta.15] - 2018-09-28

## [1.0.0-beta.14] - 2018-09-25

## [1.0.0-beta.13] - 2018-09-25

## [1.0.0-beta.12] - 2018-09-25

## [1.0.0-beta.11] - 2018-09-25

## [1.0.0-beta.10] - 2018-09-25

## [1.0.0-beta.9] - 2018-09-25

## [1.0.0-beta] - 2018-09-21
### Added
- Added changelog :grimacing:.
- Added MetricsAccumulator
- Added Metrics support in HttpClient

### Changed
- Lint the whole damn thing.
- Update all dependencies.

## [0.48.0] - 2018-09-21
### Changed
- `HttpClient` now adds `'Accept-Encoding': 'gzip'` header by default.
