## Why

Metrics and logs emitted through the diagnostics API cannot currently be grouped or filtered by the Kubernetes cluster that produced them. Adding stable cluster identity and role dimensions will make cross-cluster comparison, incident isolation, and dashboard segmentation possible.

## What Changes

- Read the Kubernetes cluster identifier/name from `VTEX_CLUSTER_ID` and cluster role from `VTEX_CLUSTER_ROLE`.
- Attach the values as `cluster_id` and `cluster_role` dimensions to diagnostics metrics and logs.
- Apply the dimensions centrally so built-in and application-provided telemetry receive the same metadata.
- Omit unavailable or empty cluster metadata rather than emitting misleading placeholder values.
- Add coverage for configured and missing cluster metadata.

## Capabilities

### New Capabilities
- `cluster-telemetry-dimensions`: Defines how Kubernetes cluster identity and role are represented on diagnostics metrics and logs.

### Modified Capabilities

None.

## Impact

- Telemetry initialization in `src/service/telemetry/client.ts`.
- Diagnostics metric and log tests, plus constants for `VTEX_CLUSTER_ID` and `VTEX_CLUSTER_ROLE`.
- Metrics and logs gain two low-cardinality dimensions; dashboards and queries can adopt them without changing metric names or log messages.
- The deployment/runtime contract exposes the authoritative Kubernetes cluster identifier/name and role through `VTEX_CLUSTER_ID` and `VTEX_CLUSTER_ROLE`.
