import request from 'request-promise';
import getEndpointUrl from './utils/appsEndpoints.js';

class AppsClient {
  constructor({endpointUrl = getEndpointUrl('STABLE'), authToken}) {
    this.authToken = authToken;
    this.endpointUrl = endpointUrl;

    this.defaultRequestOptions = {
      json: true,
      headers: {
        Authorization: `token ${authToken}`,
      }
    };
  }

  listApps(vendor) {
    debugger;
    const url = `${this.endpointUrl}${this.routes.Apps(vendor)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  getApp(app) {
    const url = `${this.endpointUrl}${this.routes.App(app)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  getAppVersion(app, version) {
    const url = `${this.endpointUrl}${this.routes.AppVersion(app, version)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  listRootFolders(app, version) {
    const url = `${this.endpointUrl}${this.routes.RootFolders(app, version)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  listFiles(app, version, service, options) {
    const url = `${this.endpointUrl}${this.routes.Files(app, version, service)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: options
    });
  }

  getFile(app, version, service, path) {
    const url = `${this.endpointUrl}${this.route.File(app, version, service, path)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  getSettingsSchema(app, version) {
    const url = `${this.endpointUrl}${this.route.SettingsSchema(app, version)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }
}

AppsClient.prototype.routes = {
  Apps(vendor) {
    return `/${vendor}/apps`;
  },

  App(appId) {
    return `/${appId.vendor}/apps/${appId.name}`;
  },

  AppVersion(appId, version) {
    return `/${appId.vendor}/apps/${appId.name}/${version}`;
  },

  RootFolders(appId, version) {
    return `/${appId.Vendor}/apps/${appId.Name}/${version}/files`;
  },

  Files(appId, version, service) {
    return `/${appId.Vendor}/apps/${appId.Name}/${version}/files/${service}`;
  },

  File(appId, version, service, path) {
    return `/${appId.Vendor}/apps/${appId.Name}/${version}/files/${service}/${path}`;
  },

  SettingsSchema(appId, version) {
    return `/${appId.Vendor}/apps/${appId.Name}/${version}/settings-schema`;
  }
}

export default AppsClient;
