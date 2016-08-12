# VTEX I/O API Client for Node

This client enables Node developers to quickly integrate with the VTEX I/O API.

[![Build Status](https://travis-ci.org/vtex/node-vtex-api.svg?branch=master)](https://travis-ci.org/vtex/node-vtex-api)

## Getting started

The three clients in this library are:

- AppsClient
- RegistryClient
- VBaseClient

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
