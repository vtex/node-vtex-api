# VTEX IO API Client for Node

This client enables Node developers to quickly integrate with the VTEX IO APIs.

[![Build Status](https://travis-ci.org/vtex/node-vtex-api.svg?branch=master)](https://travis-ci.org/vtex/node-vtex-api)

## Getting started

Usage:

We generally create a `Resources` class that groups all relevant clients and initialize them with the current request's `ctx.vtex` context, which includes `authToken`, `account`, `workspace`, etc.

```
import {Apps, LRUCache, Registry, VBase, ServiceContext} from '@vtex/api'

const MAX_ELEMS = 1000
const RESPONSE_CACHE_TTL_MS = 60 * 60 * 1000
const LONG_TIMEOUT = 20 * 1000

const cacheStorage = new LRUCache<string, any>({
  max: MAX_ELEMS,
  maxAge: RESPONSE_CACHE_TTL_MS,
})

// `cacheStorage` has a `getStats` method.
metrics.addOnFlushMeter(() => ({...cacheStorage.getStats(), name: 'example-cache-stats'}))

export default class Resources {
  public apps: Apps
  public registry: Registry
  public vbase: VBase
  
  constructor (ctx: ColossusContext) {
    const opts = {cacheStorage}
    const withLongTimeout = {...opts, timeout: LONG_TIMEOUT}

    this.apps = new Apps(ctx.vtex, withLongTimeout)
    this.registry = new Registry(ctx.vtex, withLongTimeout)
    this.vbase = new VBase(ctx.vtex, opts)
  }
}
```

## Development

Install the dependencies (`yarn`) and run `yarn watch`.

### Using VBaseClient.sendFile

An example usage of the three supported methods of sending a file to VBase:

```js
import {VBase} from '@vtex/api'
import {createReadStream} from 'fs'

const client = new VBase({
  account: 'account',
  workspace: 'workspace',
  authToken: 'test',
  userAgent: 'test send',
  region: 'aws-us-east-1',
})

client.saveFile(
  'bucket',
  'test-send-stream-gzip.txt',
  createReadStream('./test-send.txt'),
  {gzip: true, gzipOptions: {level: 9}}
).then((res) => {
  console.log('gz:', res)
})

client.saveFile(
  'bucket',
  'test-send-stream.txt',
  createReadStream('./test-send.txt'),
  {gzip: false}
).then((res) => {
  console.log('stream:', res)
})

client.saveFile(
  'bucket',
  'test-send-file.txt',
  './test-send.txt'
).then((res) => {
  console.log('file:', res)
})
```
