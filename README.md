# VTEX Apps SDK for Node

This SDK enables Node developers to quickly integrate with the VTEX Apps API.

## Getting started

The three clients in this library are: AppsClient, SandboxesClient and WorkspaceAppsClient. The easiest way to create an instance of any of them is by using as follows:

```js
var AppsClient = require('@vtex/apps-sdk').AppsClient;

var client = new AppsClient({ authToken: yourAuthToken });
```

## Development

Install the dependencies (`npm install`) and run `npm run build`.
