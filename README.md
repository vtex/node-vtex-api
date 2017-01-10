# VTEX IO API Client for Node

This client enables Node developers to quickly integrate with the VTEX IO APIs.

[![Build Status](https://travis-ci.org/vtex/node-vtex-api.svg?branch=master)](https://travis-ci.org/vtex/node-vtex-api)

## Getting started

The clients currently available  in this library are:

- AppsClient
- RegistryClient
- VBaseClient
- VTEXIDClient

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

An example usage of the three supported method of sending a file to VBase:

```
import {VBaseClient} from '@vtex/api'
import {createReadStream} from 'fs'

const client = new VBaseClient({
  authToken: 'test',
  userAgent: 'test send',
  endpointUrl: 'BETA',
})

client.saveFile(
  'account',
  'workspace',
  'bucket',
  'test-send-stream-gzip.txt',
  createReadStream('./test-send.txt'),
  {gzip: true, gzipOptions: {level: 9}}
).then((res) => {
  console.log('gz:', res)
})

client.saveFile(
  'account',
  'workspace',
  'bucket',
  'test-send-stream.txt',
  createReadStream('./test-send.txt'),
  {gzip: false}
).then((res) => {
  console.log('stream:', res)
})

client.saveFile(
  'account',
  'workspace',
  'bucket',
  'test-send-file.txt',
  './test-send.txt'
).then((res) => {
  console.log('file:', res)
})
```
