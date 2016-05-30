# VTEX Apps Client for Node

This client enables Node developers to quickly integrate with the VTEX Workspaces API.

## Getting started

The three clients in this library are: AppsClient, SandboxesClient and WorkspaceAppsClient. Usage:

```js
import { AppsClient } from '@vtex/apps';

const client = new AppsClient({
  authToken: yourAuthToken,
  userAgent: myUserAgent
});
```

## Development

Install the dependencies (`npm install`) and run `npm run build`.
