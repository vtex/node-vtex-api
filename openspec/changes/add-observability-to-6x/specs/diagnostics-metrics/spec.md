## ADDED Requirements

### Requirement: Latency recording via a shared histogram
`node-vtex-api@6.x` SHALL expose a `DiagnosticsMetrics.recordLatency` method that records a duration, in milliseconds, to a single shared histogram instrument (`io_app_operation_duration_milliseconds`), accepting either a `process.hrtime()` tuple or a raw millisecond number.

#### Scenario: Recording latency from an hrtime tuple
- **GIVEN** a `DiagnosticsMetrics` instance with an initialized metrics client
- **WHEN** a caller invokes `recordLatency([seconds, nanoseconds], attributes)`
- **THEN** the value is converted to milliseconds (`seconds * 1000 + nanoseconds / 1e6`)
- **AND** the converted value is recorded on the shared latency histogram with the given attributes

#### Scenario: Recording latency from a millisecond number
- **GIVEN** a `DiagnosticsMetrics` instance with an initialized metrics client
- **WHEN** a caller invokes `recordLatency(42.5, attributes)`
- **THEN** `42.5` is recorded on the shared latency histogram as-is, without unit conversion

#### Scenario: Recording latency before the metrics client is ready
- **GIVEN** a `DiagnosticsMetrics` instance whose metrics client has not finished initializing
- **WHEN** a caller invokes `recordLatency(...)`
- **THEN** the call is a no-op
- **AND** a warning is logged
- **AND** no exception is thrown

### Requirement: Named counters and gauges
`node-vtex-api@6.x` SHALL expose `DiagnosticsMetrics.incrementCounter(name, value, attributes)` and `DiagnosticsMetrics.setGauge(name, value, attributes)`, creating and caching one counter or gauge instrument per distinct `name`.

#### Scenario: Incrementing a counter by name for the first time
- **GIVEN** a `DiagnosticsMetrics` instance with no counter named `http_requests_total` created yet
- **WHEN** a caller invokes `incrementCounter('http_requests_total', 1, attributes)`
- **THEN** a counter instrument named `http_requests_total` is created
- **AND** it is incremented by `1` with the given attributes

#### Scenario: Reusing an existing counter
- **GIVEN** a counter named `http_requests_total` was already created by a prior `incrementCounter` call
- **WHEN** `incrementCounter('http_requests_total', 1, attributes)` is called again
- **THEN** the previously created counter instrument is reused
- **AND** no duplicate instrument is created for the same name

#### Scenario: Setting a gauge by name
- **GIVEN** a `DiagnosticsMetrics` instance with no gauge named `cache_items_current` created yet
- **WHEN** a caller invokes `setGauge('cache_items_current', 1024, attributes)`
- **THEN** a gauge instrument named `cache_items_current` is created
- **AND** it is set to `1024` with the given attributes

#### Scenario: Counter and gauge calls before the metrics client is ready
- **GIVEN** a `DiagnosticsMetrics` instance whose metrics client has not finished initializing
- **WHEN** a caller invokes `incrementCounter(...)` or `setGauge(...)`
- **THEN** the call is a no-op
- **AND** a warning is logged
- **AND** no exception is thrown

### Requirement: Request-scoped base attributes
`node-vtex-api@6.x` SHALL allow request-scoped "base attributes" to be set via `DiagnosticsMetrics.runWithBaseAttributes(baseAttributes, fn)`, using OpenTelemetry context propagation, so that every metric call made inside `fn` automatically includes those attributes merged with any custom attributes passed to the call.

#### Scenario: Base attributes are merged into a metric call
- **GIVEN** `runWithBaseAttributes({ 'vtex.account.name': 'mystore' }, fn)` is active
- **WHEN** `fn` calls `recordLatency`, `incrementCounter`, or `setGauge` with its own custom attributes
- **THEN** the recorded attributes include both the base attributes and the call's own custom attributes

#### Scenario: Base attributes take precedence over conflicting custom attributes
- **GIVEN** `runWithBaseAttributes({ status_code: 200 }, fn)` is active
- **WHEN** `fn` calls a metric method with a custom attribute `{ status_code: 500 }`
- **THEN** the recorded `status_code` attribute is `200`
- **AND** the conflicting custom attribute is silently dropped, without warning or error

#### Scenario: No base attributes set
- **GIVEN** no `runWithBaseAttributes` scope is active
- **WHEN** a metric call is made with custom attributes
- **THEN** only the call's own custom attributes are recorded

#### Scenario: Nested base attribute scopes do not leak
- **GIVEN** a metric call is made after a `runWithBaseAttributes` scope has already returned
- **WHEN** that call provides its own custom attributes
- **THEN** the attributes from the completed scope are not applied
- **AND** only the call's own custom attributes are recorded

### Requirement: Custom attribute cardinality limiting
`node-vtex-api@6.x` SHALL limit the number of custom attributes accepted per metric call to a fixed maximum (7) to control metric cardinality. This limit applies only to custom attributes supplied by callers; base attributes set via `runWithBaseAttributes` are never limited.

#### Scenario: Custom attributes within the limit
- **GIVEN** a metric call provides 7 or fewer custom attributes
- **WHEN** the call is recorded
- **THEN** all provided custom attributes are recorded unchanged

#### Scenario: Custom attributes exceeding the limit
- **GIVEN** a metric call provides more than 7 custom attributes
- **WHEN** the call is recorded
- **THEN** only the first 7 (by insertion order) are recorded
- **AND** the remaining attributes are dropped

#### Scenario: Warning logged for excess attributes in a linked context
- **GIVEN** a metric call provides more than 7 custom attributes
- **AND** the process is running in a linked (production) context
- **WHEN** the call is recorded
- **THEN** a warning is logged naming the number of attributes provided and the limit applied

#### Scenario: No warning logged for excess attributes outside a linked context
- **GIVEN** a metric call provides more than 7 custom attributes
- **AND** the process is not running in a linked (production) context
- **WHEN** the call is recorded
- **THEN** no warning is logged, and attributes are still truncated to 7

#### Scenario: Base attributes are not counted toward the limit
- **GIVEN** base attributes are active in the current scope alongside 7 custom attributes
- **WHEN** the call is recorded
- **THEN** all base attributes are included in full
- **AND** the custom-attribute limit is applied only to the custom attributes

### Requirement: Split traces, metrics, and logs telemetry clients
`node-vtex-api@6.x` SHALL initialize traces, metrics, and logs clients independently from a single `TelemetryClientSingleton`, backed by `@vtex/diagnostics-nodejs`, replacing the previous single bare `TelemetryClient`. Each client SHALL be created at most once and cached for reuse.

#### Scenario: Independent client initialization
- **GIVEN** no telemetry clients have been initialized yet
- **WHEN** `getTelemetryClients()` is called
- **THEN** it returns traces, metrics, and logs clients
- **AND** each is initialized from the same underlying `@vtex/diagnostics-nodejs` telemetry client

#### Scenario: Clients are cached after first initialization
- **GIVEN** `getTelemetryClients()` has already resolved once
- **WHEN** `getTelemetryClients()` is called again
- **THEN** the cached clients are returned
- **AND** `NewTelemetryClient` is not invoked again

#### Scenario: Concurrent requests during initialization
- **GIVEN** `getTelemetryClients()` initialization is in flight but not yet resolved
- **WHEN** `getTelemetryClients()` is called again before it resolves
- **THEN** all callers receive the result of the same single in-flight initialization
- **AND** no duplicate telemetry clients are created

#### Scenario: Reset clears cached clients
- **GIVEN** telemetry clients have already been initialized and cached
- **WHEN** `reset()` is called
- **THEN** the next call to `getTelemetryClients()` triggers a fresh initialization

#### Scenario: Existing structured logging keeps working
- **GIVEN** the structured logger (`src/service/logger/client.ts`) previously depended on a single `getTelemetryClient()` call
- **WHEN** the logger requests a telemetry client after this change
- **THEN** it receives the logs client from the split `TelemetryClientSingleton`
- **AND** it continues exporting logs exactly as before the change

### Requirement: Cluster resource attributes on emitted telemetry
`node-vtex-api@6.x` SHALL attach cluster identification as resource attributes (`vtex_io.cluster.id`, `vtex_io.cluster.role`) to metrics and logs clients when the corresponding environment values are present, trimming whitespace and omitting empty or missing values.

#### Scenario: Both cluster values present
- **GIVEN** both `VTEX_CLUSTER_ID` and `VTEX_CLUSTER_ROLE` are set to non-empty values
- **WHEN** the telemetry clients are initialized
- **THEN** both `vtex_io.cluster.id` and `vtex_io.cluster.role` resource attributes are attached to the metrics and logs clients

#### Scenario: One cluster value missing
- **GIVEN** only `VTEX_CLUSTER_ID` is set (`VTEX_CLUSTER_ROLE` is unset)
- **WHEN** the telemetry clients are initialized
- **THEN** only the `vtex_io.cluster.id` resource attribute is attached
- **AND** `vtex_io.cluster.role` is omitted entirely, not set to an empty string

#### Scenario: Whitespace-only values are treated as absent
- **GIVEN** `VTEX_CLUSTER_ID` is set to `'   '` (whitespace only)
- **WHEN** the telemetry clients are initialized
- **THEN** the `vtex_io.cluster.id` resource attribute is omitted
- **AND** the value is trimmed before the emptiness check is applied

#### Scenario: Both values absent
- **GIVEN** neither `VTEX_CLUSTER_ID` nor `VTEX_CLUSTER_ROLE` is set
- **WHEN** the telemetry clients are initialized
- **THEN** no cluster resource attributes are attached

### Requirement: Automatic Koa and host metrics instrumentation
`node-vtex-api@6.x` SHALL register OpenTelemetry auto-instrumentation for Koa request handling and for host-level metrics (event loop, memory, CPU) as part of telemetry client initialization.

#### Scenario: Koa instrumentation registered on initialization
- **GIVEN** diagnostics telemetry is enabled
- **WHEN** the telemetry clients are initialized
- **THEN** `KoaInstrumentation` is registered against the telemetry client
- **AND** request spans/metrics are captured without any manual instrumentation in app code

#### Scenario: Host metrics collected automatically
- **GIVEN** diagnostics telemetry is enabled
- **WHEN** the telemetry clients are initialized
- **THEN** `HostMetricsInstrumentation` is started
- **AND** host-level metrics (event loop lag, memory, CPU) are collected automatically without app code calling `DiagnosticsMetrics` directly

### Requirement: Feature flag gating
`node-vtex-api@6.x` SHALL gate diagnostics telemetry behind the `DIAGNOSTICS_TELEMETRY_ENABLED` environment flag, defaulting to disabled. When disabled, the underlying `@vtex/diagnostics-nodejs` telemetry client is constructed in the SDK's built-in no-op mode (`noop: true`) rather than not constructed at all; auto-instrumentation registration, however, is skipped entirely rather than run in a no-op mode.

#### Scenario: Flag disabled (default)
- **GIVEN** `DIAGNOSTICS_TELEMETRY_ENABLED` is unset
- **WHEN** the service starts
- **THEN** the telemetry client is initialized with `noop: true`, so no data is actually exported
- **AND** no Koa or host-metrics auto-instrumentation is registered
- **AND** existing `6.x` app behavior is unchanged from before this feature existed

#### Scenario: Flag explicitly set to a falsy value
- **GIVEN** `DIAGNOSTICS_TELEMETRY_ENABLED` is set to any value other than the literal string `'true'` (e.g. `'false'`, `'0'`, `'no'`)
- **WHEN** the service starts
- **THEN** diagnostics telemetry remains in no-op mode, identically to the unset case

#### Scenario: Flag enabled
- **GIVEN** `DIAGNOSTICS_TELEMETRY_ENABLED` is set to `'true'`
- **WHEN** the service starts
- **THEN** the telemetry client is initialized with `noop: false`, so metrics/traces/logs are actually exported
- **AND** `DiagnosticsMetrics` becomes usable
- **AND** Koa/host-metrics auto-instrumentation is registered
