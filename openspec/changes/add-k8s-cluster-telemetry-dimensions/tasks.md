## 1. Runtime Metadata Configuration

- [x] 1.1 Add constants that read cluster identifier/name from `VTEX_CLUSTER_ID` and cluster role from `VTEX_CLUSTER_ROLE`
- [x] 1.2 Add constants for the `cluster_id` and `cluster_role` diagnostics attribute keys and document them as reserved platform attributes

## 2. Cluster Metadata Configuration

- [x] 2.1 Add a helper that maps the runtime cluster variables to their diagnostics attribute keys without using `VTEX_REGION` as a fallback
- [x] 2.2 Add normalization that trims configured values and omits undefined, empty, or whitespace-only metadata independently
- [x] 2.3 Add unit tests covering both values, either value alone, missing values, and whitespace normalization

## 3. Diagnostics Telemetry Integration

- [x] 3.1 Add the normalized `cluster_id` and `cluster_role` values conditionally to `NewTelemetryClient` resource attributes
- [x] 3.2 Add telemetry initialization tests proving diagnostics metrics and logs share the configured cluster resource attributes without changing metric-call custom attributes
- [x] 3.3 Verify initialization remains successful when neither cluster value is available

## 4. Validation

- [x] 4.1 Run the focused constants and telemetry test suites
- [x] 4.2 Run repository linting, type checking, and the relevant broader test suite
