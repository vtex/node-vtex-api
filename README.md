# VTEX IO API Client for Node

This library enables developers to quickly integrate with the VTEX IO APIs and create full fledged node services using VTEX IO.

[![Build Status](https://travis-ci.org/vtex/node-vtex-api.svg?branch=master)](https://travis-ci.org/vtex/node-vtex-api)

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
  const {state: {code}, clients: {apps}} = ctx
  console.log('Received code:', code)

  const apps = await apps.listApps()
  
  ctx.status = 200
  ctx.body = apps
  ctx.set('Cache-Control', 'private')

  await next()
}
```

`ctx.clients.apps` is an instance of `Apps`.

## Development

Install the dependencies (`yarn`) and run `yarn watch`.
