import request from 'request-promise';
import getEndpointUrl from './utils/appsEndpoints.js';
import checkRequiredParameters from './utils/required.js';

class WorkspaceSandboxesClient {
  constructor({authToken, userAgent, endpointUrl = getEndpointUrl('STABLE')}) {
    checkRequiredParameters({authToken, userAgent});
    this.authToken = authToken;
    this.endpointUrl = endpointUrl === 'BETA'
      ? getEndpointUrl(endpointUrl)
      : endpointUrl;
    this.userAgent = userAgent;

    this.defaultRequestOptions = {
      json: true,
      headers: {
        Authorization: `token ${this.authToken}`,
        'User-Agent': this.userAgent
      }
    };
  }

  listActiveSandboxes(account, workspace) {
    checkRequiredParameters({account, workspace});
    const url = `${this.endpointUrl}${this.routes.ListSandboxes(account, workspace)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url
    });
  }

  listActiveApps(account, workspace, vendor, sandbox) {
    checkRequiredParameters({account, workspace, vendor, sandbox});
    const url = `${this.endpointUrl}${this.routes.ListSandboxApps(account, workspace, vendor, sandbox)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url
    });
  }

  getAppTtl(account, workspace, vendor, sandbox, app, version) {
    checkRequiredParameters({account, workspace, vendor, sandbox, app, version});
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace, vendor, sandbox, app, version)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url
    });
  }

  updateAppTtl(account, workspace, vendor, sandbox, app, version, ttl) {
    checkRequiredParameters({account, workspace, vendor, sandbox, app, version, ttl});
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace, vendor, sandbox, app, version)}`;

    return request.put({
      ...this.defaultRequestOptions,
      url,
      body: {
        ttl
      }
    });
  }

  deactivateApp(account, workspace, vendor, sandbox, app, version) {
    checkRequiredParameters({account, workspace, vendor, sandbox, app, version});
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace, vendor, sandbox, app, version)}`;

    return request.delete({
      ...this.defaultRequestOptions,
      url
    });
  }
}

WorkspaceSandboxesClient.prototype.routes = {
  ListSandboxes(account, workspace) {
    return `/${account}/workspaces/${workspace}/sandboxes`;
  },

  ListSandboxApps(account, workspace, vendor, sandbox) {
    return `/${account}/workspaces/${workspace}/sandboxes/${vendor}/${sandbox}`;
  },

  Apps(account, workspace, vendor, sandbox, app, version) {
    return `/${account}/workspaces/${workspace}/sandboxes/${vendor}/${sandbox}/${app}/${version}`;
  }
};

export default WorkspaceSandboxesClient;
