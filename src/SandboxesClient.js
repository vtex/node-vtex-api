import request from 'request-promise';
import getEndpointUrl from './utils/appsEndpoints.js';

class SandboxesClient {
  constructor({endpointUrl = getEndpointUrl('STABLE'), authToken}) {
    this.authToken = authToken;
    this.endpointUrl = endpointUrl;

    this.defaultRequestOptions = {
      json: true,
      headers: {
        Authorization: 'token ' + authToken,
      }
    };
  }

  listSandboxes(vendor) {
    const url = this.routes.Sandboxes(vendor);

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  getSandbox(vendor, sandbox) {
    const url = this.routes.Sandbox(vendor, sandbox);

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  getManifest(vendor, sandbox, app, version) {
    const url = this.routes.App(vendor, sandbox, app, version);

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  getSettingsSchema(vendor, sandbox, app, version) {
    const url = this.routes.SettingsSchema(vendor, sandbox, app, version);

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  listRootFolders(vendor, sandbox, app, version) {
    const url = this.routes.RootFolders(vendor, sandbox, app, version);

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }

  listFiles(vendor, sandbox, app, service, version, options) {
    const url = this.routes.Files(vendor, sandbox, app, version, service);

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: options
    });
  }

  getFile(vendor, sandbox, app, service, path, version) {
    const url = this.routes.File(vendor, sandbox, app, version, service, path);

    return request.get({
      ...this.defaultRequestOptions,
      url,
    });
  }
}

SandboxesClient.prototype.routes = {
  Sandboxes(vendor) {
    return `/${vendor}/sandboxes`;
  },

  Sandbox(vendor, sandbox) {
    return `/${vendor}/sandboxes/${sandbox}`;
  },

  App(vendor, sandbox, app, version) {
    return `/${vendor}/sandboxes/${sandbox}/${app}/${version}`;
  },

  SettingsSchema(vendor, sandbox, app, version) {
    return `/${vendor}/sandboxes/${sandbox}/${app}/${version}/settings-schema`;
  },

  RootFolders(vendor, sandbox, app, version) {
    return `/${vendor}/sandboxes/${sandbox}/${app}/${version}/files`;
  },

  Files(vendor, sandbox, app, version, service) {
    return `/${vendor}/sandboxes/${sandbox}/${app}/${version}/files/${service}`;
  },

  File(vendor, sandbox, app, version, service, path) {
    return `/${vendor}/sandboxes/${sandbox}/${app}/${version}/files/${service}/${path}`;
  }
}

export default SandboxesClient;
