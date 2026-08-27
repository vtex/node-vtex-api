## 1. Runtime Metadata Configuration

- [x] 1.1 Add constants that read cluster identifier/name from `VTEX_CLUSTER_ID` and cluster role from `VTEX_CLUSTER_ROLE`
- [x] 1.2 Expose `ATTR_VTEX_IO_CLUSTER_ID` and `ATTR_VTEX_IO_CLUSTER_ROLE` through `AttributeKeys`, following the existing semantic-convention pattern

## 2. Cluster Metadata Configuration

- [x] 2.1 Add a helper that maps the runtime cluster variables to `vtex_io.cluster.id` and `vtex_io.cluster.role` without using `VTEX_REGION` as a fallback
- [x] 2.2 Add normalization that trims configured values and omits undefined, empty, or whitespace-only metadata independently
- [x] 2.3 Add unit tests covering both values, either value alone, missing values, and whitespace normalization

## 3. Diagnostics Telemetry Integration

- [x] 3.1 Add the normalized semantic-convention cluster values conditionally to `NewTelemetryClient` resource attributes
- [x] 3.2 Add telemetry initialization tests proving diagnostics metrics and logs share `vtex_io.cluster.id` and `vtex_io.cluster.role` without changing metric-call custom attributes
- [x] 3.3 Verify initialization remains successful when neither cluster value is available

## 4. Validation

- [x] 4.1 Confirm the previous build and focused-test failures were limited to the then-unpublished `ATTR_VTEX_IO_CLUSTER_ID` and `ATTR_VTEX_IO_CLUSTER_ROLE` exports
- [x] 4.2 Update `@vtex/diagnostics-semconv` to `5.5.2` and run repository linting, type checking, and the broader test suite
