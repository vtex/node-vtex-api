## ADDED Requirements

### Requirement: Diagnostics metrics include Kubernetes cluster dimensions
The system SHALL attach configured Kubernetes cluster metadata to every metric emitted through the diagnostics telemetry client. The Kubernetes cluster identifier or name SHALL be exported as `vtex_io.cluster.id`, and the cluster role SHALL be exported as `vtex_io.cluster.role`.

#### Scenario: Both cluster values are configured for metrics
- **WHEN** diagnostics telemetry initializes with non-empty cluster identifier and cluster role metadata
- **THEN** every diagnostics metric has `vtex_io.cluster.id` and `vtex_io.cluster.role` resource dimensions containing the configured values

#### Scenario: Automatically instrumented metric is emitted
- **WHEN** an automatic or built-in diagnostics metric is emitted after telemetry initialization
- **THEN** the metric has the same `vtex_io.cluster.id` and `vtex_io.cluster.role` resource dimensions as an application-provided metric

### Requirement: Diagnostics logs include Kubernetes cluster dimensions
The system SHALL attach configured Kubernetes cluster metadata to every log emitted through the diagnostics telemetry client, using `vtex_io.cluster.id` for the Kubernetes cluster identifier or name and `vtex_io.cluster.role` for the cluster role.

#### Scenario: Both cluster values are configured for logs
- **WHEN** the diagnostics logger emits a log after telemetry initializes with non-empty cluster identifier and cluster role metadata
- **THEN** the log has `vtex_io.cluster.id` and `vtex_io.cluster.role` resource dimensions containing the configured values

#### Scenario: Logs and metrics use consistent cluster values
- **WHEN** a diagnostics metric and diagnostics log are emitted by the same process
- **THEN** both signals have identical `vtex_io.cluster.id` and `vtex_io.cluster.role` values

### Requirement: Missing cluster metadata is omitted safely
The system SHALL normalize cluster metadata by trimming surrounding whitespace and SHALL omit a cluster dimension when its configured value is undefined, empty, or whitespace-only. Availability of one cluster value SHALL NOT depend on availability of the other.

#### Scenario: No cluster metadata is configured
- **WHEN** diagnostics telemetry initializes without a cluster identifier and cluster role
- **THEN** telemetry initialization succeeds and neither `vtex_io.cluster.id` nor `vtex_io.cluster.role` is emitted

#### Scenario: Only cluster identifier is configured
- **WHEN** diagnostics telemetry initializes with a non-empty cluster identifier and no cluster role
- **THEN** emitted diagnostics metrics and logs include `vtex_io.cluster.id` and omit `vtex_io.cluster.role`

#### Scenario: Only cluster role is configured
- **WHEN** diagnostics telemetry initializes with a non-empty cluster role and no cluster identifier
- **THEN** emitted diagnostics metrics and logs include `vtex_io.cluster.role` and omit `vtex_io.cluster.id`

#### Scenario: Cluster metadata contains surrounding whitespace
- **WHEN** configured cluster metadata contains leading or trailing whitespace
- **THEN** emitted cluster dimensions contain the trimmed values

### Requirement: Cluster dimensions use deployment metadata
The system MUST obtain cluster identity from `process.env.VTEX_CLUSTER_ID` and cluster role from `process.env.VTEX_CLUSTER_ROLE` and SHALL keep those values constant for the lifetime of the telemetry client. The system SHALL NOT use `VTEX_REGION` as a fallback for cluster identity. The attribute keys SHALL come from `ATTR_VTEX_IO_CLUSTER_ID` and `ATTR_VTEX_IO_CLUSTER_ROLE` exported by `@vtex/diagnostics-semconv`.

#### Scenario: Telemetry client is initialized
- **WHEN** the process creates its diagnostics telemetry client
- **THEN** it reads cluster identity from `VTEX_CLUSTER_ID` and cluster role from `VTEX_CLUSTER_ROLE` and applies them as resource attributes
- **AND** it uses the generated VTEX IO semantic-convention keys rather than locally defined attribute-name strings

#### Scenario: Request data differs between telemetry calls
- **WHEN** metrics or logs are emitted for different accounts, workspaces, routes, or operations
- **THEN** their cluster dimensions remain the deployment-level values selected at telemetry initialization
