# VTEX IO API Client for Node

This client enables Node developers to quickly integrate with the VTEX IO APIs.

[![Build Status](https://travis-ci.org/vtex/node-vtex-api.svg?branch=master)](https://travis-ci.org/vtex/node-vtex-api)

## Getting started

The clients currently available  in this library are:

- [VBase](https://github.com/vtex/node-vtex-api/blob/feature/context-bound/src/VBase.js#L22)
- [Apps](https://github.com/vtex/node-vtex-api/blob/feature/context-bound/src/Apps.js#L51)
- [Registry](https://github.com/vtex/node-vtex-api/blob/feature/context-bound/src/Registry.js#L27)
- [Router](https://github.com/vtex/node-vtex-api/blob/feature/context-bound/src/Router.js#L19)
- [Workspaces](https://github.com/vtex/node-vtex-api/blob/feature/context-bound/src/Workspaces.js#18)
- [ID](https://github.com/vtex/node-vtex-api/blob/feature/context-bound/src/ID.js#L13)

Usage:

```js
import { AppsClient } from '@vtex/api';

const client = new AppsClient({
  authToken: yourAuthToken,
  userAgent: myUserAgent
});
```

## Development

Install the dependencies (`npm install`) and run `npm run build`.


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
