import request from 'request-promise';
import getEndpointUrl from './utils/appsEndpoints.js';
import checkRequiredParameters from './utils/required.js';

class WorkspaceAppsClient {
  constructor({authToken, userAgent, endpointUrl = getEndpointUrl('STABLE')}) {
    checkRequiredParameters({authToken, userAgent});
    this.authToken = authToken;
    this.endpointUrl = endpointUrl;
    this.userAgent = userAgent;

    this.defaultRequestOptions = {
      json: true,
      headers: {
        Authorization: `token ${this.authToken}`,
        'User-Agent': this.userAgent
      }
    };
  }

  installApp(account, workspace, app, version, simulation) {
    checkRequiredParameters({account, workspace, app, version});
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace)}`;

    return request.post({
      ...this.defaultRequestOptions,
      url,
      qs: {
        simulation: !!simulation
      },
      body: {
        install: {
          [app]: version
        }
      }
    });
  }

  uninstallApp(account, workspace, app, simulation) {
    checkRequiredParameters({account, workspace, app});
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace)}`;

    return request.post({
      ...this.defaultRequestOptions,
      url,
      qs: {
        simulation: !!simulation
      },
      body: {
        uninstall: [app]
      }
    });
  }

  publishApp(vendor, zip) {
    checkRequiredParameters({vendor, zip});
    const url = `${this.endpointUrl}${this.routes.VendorApps(vendor)}`;

    return request.post({
      ...this.defaultRequestOptions,
      url,
      formData: {
        attachments: [zip]
      }
    });
  }

  listDependencies(account, workspace, service, paging, recursive) {
    checkRequiredParameters({account, workspace, service});
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace, service)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        paging,
        recursive: !!recursive
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
        recursive: !!recursive
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
  VendorApps(vendor) {
    return `/${vendor}/apps`;
  },

  Apps(account, workspace) {
    return `/${account}/workspaces/${workspace}/apps`;
  },

  App(account, workspace, app) {
    return `/${account}/workspaces/${workspace}/apps/${app}`;
  },

  AppDependencies(account, workspace, app) {
    return `/${account}/workspaces/${workspace}/apps/${app}/dependencies`;
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
