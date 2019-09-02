# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Update missing changelog: remove if statements on existence of ctx.vtex.logger

## [3.47.1] - 2019-08-29
### Fixed
- Fix ramda typings errors.

## [3.47.0] - 2019-08-29
### Added
- Add parameter `skipSemVerEnsure` in app publish.

## [3.46.0] - 2019-08-26

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
