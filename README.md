# VTEX I/O API Client for Node

This client enables Node developers to quickly integrate with the VTEX I/O API.

[![Build Status](https://travis-ci.org/vtex/node-vtex-api.svg?branch=master)](https://travis-ci.org/vtex/node-vtex-api)

## Getting started

The three clients in this library are:

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

const read = createReadStream('./test-send.txt')

client.saveFile(
  'account',
  'workspace',
  'bucket',
  'test-send-stream-gzip.txt',
  read,
  {gzip: true}
).then((res) => {
  console.log('gz:', res)
})

client.saveFile(
  'account',
  'workspace',
  'bucket',
  'test-send-stream.txt',
  read,
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
