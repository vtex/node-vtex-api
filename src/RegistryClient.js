import request from 'request-promise';
import getEndpointUrl from './utils/appsEndpoints.js';
import checkRequiredParameters from './utils/required.js';

class RegistryClient {
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

  publishApp(account, workspace, zip, pre = false) {
    checkRequiredParameters({account, workspace, zip});
    const url = `${this.endpointUrl}${this.routes.Registry(account, workspace)}`;

    return request.post({
      ...this.defaultRequestOptions,
      url,
      qs: {
        isPreRelease: pre
      },
      formData: {
        zip
      }
    });
  }

  publishAppPatch(account, workspace, vendor, name, version, changes) {
    checkRequiredParameters({account, workspace, vendor, name, version, changes});
    const url = `${this.endpointUrl}${this.routes.RegistryAppVersion(account, workspace, vendor, name, version)}`;

    return request.patch({
      ...this.defaultRequestOptions,
      url,
      body: changes
    });
  }

  listVendors(account, workspace) {
    checkRequiredParameters({account, workspace});
    const url = `${this.endpointUrl}${this.routes.Registry(account, workspace)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url
    });
  }

  listAppsByVendor(account, workspace, vendor) {
    checkRequiredParameters({account, workspace, vendor});
    const url = `${this.endpointUrl}${this.routes.RegistryVendor(account, workspace, vendor)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url
    });
  }

  listVersionsByApp(account, workspace, vendor, name, major = '') {
    checkRequiredParameters({account, workspace, vendor, name});
    const url = `${this.endpointUrl}${this.routes.RegistryApp(account, workspace, vendor, name)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url,
      qs: {
        major
      }
    });
  }

  getAppManifest(account, workspace, vendor, name, version) {
    checkRequiredParameters({account, workspace, vendor, name, version});
    const url = `${this.endpointUrl}${this.routes.RegistryVendor(account, workspace, vendor, name, version)}`;

    return request.get({
      ...this.defaultRequestOptions,
      url
    });
  }

  unpublishApp(account, workspace, vendor, name, version) {
    checkRequiredParameters({account, workspace, vendor, name, version});
    const url = `${this.endpointUrl}${this.routes.RegistryVendor(account, workspace, vendor, name, version)}`;

    return request.delete({
      ...this.defaultRequestOptions,
      url
    });
  }
}

RegistryClient.prototype.routes = {
  Registry(account, workspace) {
    return `/${account}/${workspace}/registry`;
  },

  RegistryVendor(account, workspace, vendor) {
    return `${this.Registry(account, workspace)}/${vendor}/apps`;
  },

  RegistryApp(account, workspace, vendor, name) {
    return `${this.RegistryVendor(account, workspace, vendor)}/${name}`;
  },

  RegistryAppVersion(account, workspace, vendor, name, version) {
    return `${this.RegistryApp(account, workspace, vendor, name)}/${version}`;
  }
};

export default RegistryClient;
