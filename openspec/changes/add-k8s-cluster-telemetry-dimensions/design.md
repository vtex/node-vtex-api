## Context

The diagnostics telemetry stack is initialized once in `src/service/telemetry/client.ts`. `NewTelemetryClient` receives `additionalAttrs`, which become resource attributes shared by the metrics, logs, and traces clients created from that telemetry client. Today those attributes identify the IO app, vendor, version, and workspace, while signal-specific code adds request and operation dimensions.

Cluster metadata is deployment-level rather than request-level. Adding it independently at every metric and log call site would duplicate logic, miss automatic or future instrumentation, and consume the custom metric attribute budget enforced by `DiagnosticsMetrics`.

## Goals / Non-Goals

**Goals:**

- Export the authoritative Kubernetes cluster identifier/name as `cluster_id`.
- Export the cluster's platform role as `cluster_role`.
- Make both dimensions available on every diagnostics metric and log, including automatically instrumented telemetry.
- Preserve current behavior when either metadata value is unavailable.
- Keep cluster metadata low-cardinality and constant for the process lifetime.

**Non-Goals:**

- Deriving cluster identity from hostnames, pod names, request headers, or network calls.
- Adding pod, node, namespace, or workload dimensions.
- Renaming existing metrics, changing log messages, or modifying legacy console-based telemetry.
- Requiring cluster metadata when running locally or outside Kubernetes.

## Decisions

### Add cluster metadata as telemetry resource attributes

The implementation will extend the `additionalAttrs` passed to `NewTelemetryClient` with non-empty `cluster_id` and `cluster_role` values. This is the single initialization point shared by diagnostics metrics and logs and covers direct instruments, the `DiagnosticsMetrics` wrapper, host metrics, and logger calls.

Per-call instrumentation was rejected because the repository has several independent metric paths and automatic instrumentation. Updating every call site would be error-prone and would count the values against the seven custom attributes accepted by `DiagnosticsMetrics`.

Because the diagnostics clients share one OpenTelemetry resource, traces may also carry these attributes. That consistency is accepted as a side effect; metrics and logs are the required signals.

### Treat runtime metadata as authoritative configuration

The cluster identifier/name will be read from `process.env.VTEX_CLUSTER_ID`, and the cluster role will be read from `process.env.VTEX_CLUSTER_ROLE`. Both values will be normalized by trimming whitespace. Empty, whitespace-only, or undefined values will be omitted independently. `VTEX_REGION` will not be used as a fallback because region and cluster identity have different semantics.

Fallback strings such as `unknown` were rejected because they create an artificial cluster that combines unrelated local or misconfigured workloads.

### Keep the exported dimension names stable

The diagnostics attribute keys will be exactly `cluster_id` and `cluster_role`, matching the requested query dimensions. Constants will centralize both runtime configuration access and exported keys to prevent spelling drift.

## Risks / Trade-offs

- **A runtime does not inject the cluster variables** → Treat both variables as optional and add tests around the resulting constants.
- **Resource attributes also appear on traces** → Accept this because the telemetry client shares a resource and consistent deployment identity is useful across signals.
- **Additional dimensions increase metric series count** → Cluster identity and role are bounded deployment metadata; do not add pod- or request-level values.
- **A deployment omits one value** → Emit the available dimension independently and omit only the missing one.
- **A caller emits a data-point attribute with the same key** → Document `cluster_id` and `cluster_role` as reserved platform dimensions and test the diagnostics payload shape at initialization.

## Migration Plan

1. Add constants for `VTEX_CLUSTER_ID` and `VTEX_CLUSTER_ROLE` and conditionally include their normalized values in diagnostics resource attributes.
2. Deploy without changing existing metric names or log schemas beyond the two optional dimensions.
3. Verify emitted metrics and logs in one development cluster before broad rollout.
4. Roll back by reverting the resource attributes; no stored-data migration is required.
