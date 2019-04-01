# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- Class `IODataSource` changed to `IOClient`

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

