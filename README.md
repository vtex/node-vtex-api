[![Build Status](https://travis-ci.org/vtex/node-vtex-api.svg?branch=master)](https://travis-ci.org/vtex/node-vtex-api)

<p align="center">
  <img alt="VTEX Frontend Metrics Gateway" src="./assets/vtex-logo.svg" height="100" />
  <h3 align="center">VTEX IO API Client for Node</h3>
  <p align="center">This library enables developers to quickly integrate with the VTEX IO APIs and create full fledged node services using VTEX IO.</p>
</p>

---

- [Development](#development)
  - [Development with IO clients](#development-with-io-clients)
- [Getting started](#getting-started)
- [GraphQL directives](#graphql-directives)
- [Auth](#auth)
- [Cache Control](#cache-control)
  - [maxAge](#maxage)
  - [scope](#scope)
- [Deprecated](#deprecated)
- [Sanitize](#sanitize)
- [TranslatableV2](#translatablev2)
- [SmartCache](#smartcache)
- [TranslateTo](#translateto)
  - [language](#language)
- [Metric](#metric)
  - [name](#name)
- [Internal (VTEXers only)](#internal-vtexers-only)

---

## Development

- Install the dependencies: `yarn`
- Watch for changes: `yarn watch`

### Development with IO clients

- Install the dependencies: `yarn`
- [Link](https://classic.yarnpkg.com/en/docs/cli/link/) this package: `yarn link`
- Watch for changes: `yarn watch`
- Move to the app that depends on the changes made on this package: `cd ../<your-app>/node`
- Link this package to your app's node_modules: `yarn link @vtex/api`

Now, when you get a workspace up and running for your app with `vtex link`, you'll have this package linked as well.

> When done developing, don't forget to unlink it from `<your-app>/node`: `yarn unlink @vtex/api`

## Getting started

For a complete example on using `@vtex/api`, check out this app: https://github.com/vtex-apps/service-example

The most basic usage is to export a new `Service()` with your route handlers:

```javascript
// Import global types
import './globals'

import { Service } from '@vtex/api'

import { clients } from './clients'
import example from './handlers/example'

// Export a service that defines route handlers and client options.
export default new Service({
  clients,
  routes: {
    example,
  },
})
```

This allows you to define middlewares that receive a `Context` param which contains all IO Clients in the `clients` property:

```javascript
export const example = async (ctx: Context, next: () => Promise<void>) => {
  const {
    state: { code },
    clients: { apps },
  } = ctx
  console.log('Received code:', code)

  const apps = await apps.listApps()

  ctx.status = 200
  ctx.body = apps
  ctx.set('Cache-Control', 'private')

  await next()
}
```

`ctx.clients.apps` is an instance of `Apps`.

## GraphQL directives

GraphQL has a nice feature called [Schema Directives](https://www.graphql-tools.com/docs/schema-directives/) that allows developers to **annotate a schema** in order to augment its functionalities. Those directives can be implemented with code (almost like resolvers themselves) and altering the behavior of that query/mutation where present.

Here are some **[default platform directives**](https://github.com/vtex/node-vtex-api/tree/master/src/service/worker/runtime/graphql/schema/schemaDirectives) that you can use when developing VTEX IO GraphQL services. They can specify scope and policy, authorize actions, and more:

## Auth

`@auth(productCode: String resourceCode: String)`

The `@auth` directive connects directly with [VTEX ID](https://help.vtex.com/tutorial/integracao-com-vtex-id--4wGcnjMDg5KpLc40o14dDd) and [License Manager](https://developers.vtex.com/vtex-rest-api/reference/license-manager-api-overview) and can be used to implement role-based access to some GraphQL operations. The directive takes **two arguments:** `productCode` and `resourceCode` that specify **which resource, on License Manager, the caller must have to perform that query or mutation.** If the user (or app) performing that call isn't authenticated nor has access to the provided resource, the platform will return a `403 - Forbidden` error.

**Example:**

```graphql
appSettings(app: String, version: String): GenericResponse
    @auth(productCode: "66", resourceCode: "read-write-apps-settings")
```

## Cache Control

`@cacheControl(maxAge: Int scope: SEGMENT | PRIVATE | PUBLIC)`

This directive informs the platform **how that resource should be cached**, impacting:

- How the underlying HTTP calls are made by the framework
- Which route is going to be used (`/_v/{scope}/graphql/`), matching with our CDN cache configuration.
- The `Cache-Control` response header.

### maxAge

Specifies the maximum amount of time (in seconds) that the resource can be considered fresh. The enums `LONG`, `MEDIUM`, and `SHORT` can be used as well. Reference [here](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)

### scope

The cache scope helps the platform identify how to cache a resource. There are three supported values and it's very important that they are being used accordingly:

- `PRIVATE`: the response should not be cached (\*e.g: **\***user's profile data).
- `SEGMENT`: the response can be cached for the same segment (_e.g:_ catalog data on a multilanguage store)
- `PUBLIC`: the response can be cached for all public (_e.g:_ a response from a public Master Data document)

**Example:**

```graphql
installedAppPublic(slug: String!): InstalledApp
    @cacheControl(scope: PUBLIC, maxAge: SHORT)
```

## Deprecated

`@deprecated(reason: String = "No longer supported")`

Add this directive on some query/mutation that is deprecated. The users will still be able to query it, but will see a warning on GraphiQL and a message indicating the deprecated field will be logged on Splunk

**Example:**

```graphql
myOldQuery(data: string): String @deprecated
```

## Sanitize

`@sanitize(allowHTMLTags: Boolean stripIgnoreTag: Boolean)`

This is a very handy directive when creating **user-facing applications.** To avoid cross-site-scripting on your apps, you need to sanitize inputs and outputs on your service. This directive can be applied to a field, an input field, or an argument on the schema.

**Example:**

```graphql
input ProfileCustomFieldInput {
  key: String
  value: String @sanitize(allowHTMLTags: false, stripIgnoreTag: true)
}
```

## TranslatableV2

`@translatableV2(behavior: 'FULL' | 'USER_AND_APP' | 'USER_ONLY', withAppsMetaInfo: Boolean)`

This directive allows automatic translation for string messages on VTEX IO. It will handle the returned message from the field where present and call the Messages service to handle the transformation. The output language will be selected by the `ctx.vtex.locale` value (transformed from the `x-vtex-locale` HTTP request header.

**Example:**

```graphql
type Product {
  brand: String @translatableV2
}
```

## SmartCache

`@smartcache(maxAge: String)`

Just as you are able to use VTEX's SmartCache on plain-HTTP services declaring `"smartCache": true`, you can annotate GraphQL operations as well.

Adding this directive on a field definition will properly set up the HTTP response (adding `x-vtex-etag-control` header) to make use of SmartCache.

## TranslateTo

`@translateTo(language: String!)`

Translates a string to a specific language. **This is useful if you need any kind of consistent data on your application (i.g. for analytics)**.

### language

The language you want the string to be translated to. [It must follow the IETFL language tag format.](https://en.wikipedia.org/wiki/IETF_language_tag)

**Example:**

```graphql
type Product {
  brandEnUs: String @translateTo(language: "en-US")
}
```

## Metric

`@metric(name: String)`

Similar to the existing `metric` property from the RequestConfig available on the IO HTTP Client. It registers latency and status of GraphQL operations in batches to Splunk, with the `graphql-metric-` status name prefix.

### name

Sets the status name of the operation. If `another-operation` is given, the status name will be `graphql-metric-another-operation`. If no _name_ is given, it defaults to the default prefix + the application name + the field name.

**Example:**

```graphql
# suppose these queries are executed on vtex.cool-application
type Query {
  someOperation: String! @metric # status name is graphql-metric-cool-application-someOperation
  anotherOperation: String! @metric(name: "another-operation") # status name is graphql-metric-another-operation
  metriclessOperation: String!
}
```

## Internal (VTEXers only)

[You can access the internal documentation (for VTEXers) of this application by clicking here.](https://internal-docs.vtex.com/Composable-Commerce/systems/node-runtime/)
