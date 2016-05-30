import request from 'request-promise';
import getEndpointUrl from './utils/appsEndpoints.js';
import checkRequiredParameters from './utils/required.js';

class WorkspaceAppsClient {
  constructor({authToken, userAgent, endpointUrl = getEndpointUrl('STABLE')}) {
    checkRequiredParameters({authToken, userAgent});
    this.authToken = authToken;
    this.endpointUrl = endpointUrl;

    this.defaultRequestOptions = {
      json: true,
      headers: {
        Authorization: 'token ' + authToken,
      }
    };
  }

  listDependencies(account, workspace, service, paging, recursive) {
    checkRequiredParameters({account, workspace, service});
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace, service)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        paging,
        recursive: recursive ? true : null
      }
    });
  }

  getApp(account, workspace, app, context) {
    checkRequiredParameters({account, workspace, app});
    const url = `${this.endpointUrl}${this.routes.App(account, workspace, app)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        context
      }
    });
  }

  listAppDependencies(account, workspace, app, context, service, paging, recursive) {
    checkRequiredParameters({account, workspace, app, service});
    const url = `${this.endpointUrl}${this.routes.AppDependencies(account, workspace, app, service)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        paging,
        recursive: recursive ? true : null
      }
    });
  }

  listRootFolders(account, workspace, app, context) {
    checkRequiredParameters({account, workspace, app});
    const url = `${this.endpointUrl}${this.routes.RootFolders(account, workspace, app)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        context
      }
    });
  }

  listFiles(account, workspace, app, context, service, options) {
    checkRequiredParameters({account, workspace, app, service});
    const url = `${this.endpointUrl}${this.routes.Files(account, workspace, app, service)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        options,
        context
      }
    });
  }

  getFile(account, workspace, app, context, service, path) {
    checkRequiredParameters({account, workspace, app, service});
    const url = `${this.endpointUrl}${this.routes.File(account, workspace, app, service, path)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        context
      }
    });
  }
}

WorkspaceAppsClient.prototype.routes = {
  Apps(account, workspace, service) {
    return `/${account}/workspaces/${workspace}/apps?service=${service}`;
  },

  App(account, workspace, app) {
    return `/${account}/workspaces/${workspace}/apps/${app}`;
  },

  AppDependencies(account, workspace, app, service) {
    return `/${account}/workspaces/${workspace}/apps/${app}/dependencies?service=${service}`;
  },

  RootFolders(account, workspace, app) {
    return `/${account}/workspaces/${workspace}/apps/${app}/files`;
  },

  Files(account, workspace, app, service) {
    return `/${account}/workspaces/${workspace}/apps/${app}/files/${service}`;
  },

  File(account, workspace, app, service, path) {
    return `/${account}/workspaces/${workspace}/apps/${app}/files/${service}/${path}`;
  }
};

export default WorkspaceAppsClient;
