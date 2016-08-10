import request from 'request-promise';
import getEndpointUrl from './utils/appsEndpoints.js';
import checkRequiredParameters from './utils/required.js';

class AppsClient {
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

  installApp(account, workspace, descriptor) {
    checkRequiredParameters({account, workspace, descriptor});
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace)}`;

    return request.post({
      ...this.defaultRequestOptions,
      url,
      body: descriptor
    });
  }

  uninstallApp(account, workspace, vendor, name, version) {
    checkRequiredParameters({account, workspace, vendor, name, version});
    const url = `${this.endpointUrl}${this.routes.App(account, workspace, vendor, name, version)}`;

    return request.delete({
      ...this.defaultRequestOptions,
      url
    });
  }

  updateAppSettings(account, workspace, vendor, name, version, settings) {
    checkRequiredParameters({account, workspace, vendor, name, version, settings});
    const url = `${this.endpointUrl}${this.routes.App(account, workspace, vendor, name, version)}`;

    return request.put({
      ...this.defaultRequestOptions,
      url,
      body: {
        settings
      }
    });
  }

  updateAppTtl(account, workspace, vendor, name, version) {
    checkRequiredParameters({account, workspace, vendor, name, version});
    const url = `${this.endpointUrl}${this.routes.App(account, workspace, vendor, name, version)}`;

    return request.patch({
      ...this.defaultRequestOptions,
      url,
    });
  }

  listApps(account, workspace, options = {oldVersion: '', context: '', since: '', service: ''}) {
    checkRequiredParameters({account, workspace});
    const url = `${this.endpointUrl}${this.routes.Apps(account, workspace)}`;
    const {oldVersion, context, since, service} = options;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        oldVersion,
        context,
        since,
        service,
      }
    });
  }

  listAppFiles(account, workspace, vendor, name, version, {prefix = '', context = ''}) {
    checkRequiredParameters({account, workspace, vendor, name, version});
    const url = `${this.endpointUrl}${this.routes.Files(account, workspace, vendor, name, version)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        prefix,
        context
      }
    });
  }

  getAppFile(account, workspace, vendor, name, version, path, context = '') {
    checkRequiredParameters({account, workspace, vendor, name, version, path});
    const url = `${this.endpointUrl}${this.routes.File(account, workspace, vendor, name, version, path)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        context
      }
    });
  }

  getApp(account, workspace, vendor, name, version, context = '') {
    checkRequiredParameters({account, workspace, vendor, name, version});
    const url = `${this.endpointUrl}${this.routes.App(account, workspace, vendor, name, version)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        context
      }
    });
  }

  getDependencyMap(account, workspace, service = '') {
    checkRequiredParameters({account, workspace});
    const url = `${this.endpointUrl}${this.routes.DependencyMap(account, workspace)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        service
      }
    });
  }
}

AppsClient.prototype.routes = {
  Apps(account, workspace) {
    return `/${account}/${workspace}/apps`;
  },

  App(account, workspace, vendor, name, version) {
    return `/${account}/${workspace}/apps/${vendor}.${name}@${version}`;
  },

  Files(account, workspace, vendor, name, version) {
    return `${this.App(account, workspace, vendor, name, version)}/files`;
  },

  File(account, workspace, vendor, name, version, path) {
    return `${this.Files(account, workspace, vendor, name, version)}/${path}`;
  },

  DependencyMap(account, workspace) {
    return `${this.Apps(account, workspace)}/dependencyMap`;
  }
};

export default AppsClient;
