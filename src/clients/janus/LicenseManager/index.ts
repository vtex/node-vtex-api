import { RequestTracingConfig, RequestConfig, inflightUrlWithQuery } from '../../../HttpClient'
import { JanusClient } from '../JanusClient'
import {
  OptionsListBindings,
  APIBindingRes,
  OptionsGetBinding,
  OptionsCreateBinding,
  APIBindingCreate,
  Addr,
  APICreateBindingRes,
  OptionsDeleteBinding,
  OptionsUpdateBinding,
  APIBindingUpdate,
} from './types'

const TWO_MINUTES_S = 2 * 60

const BASE_URL = '/api/license-manager'

const routes = {
  accountData: () => `${BASE_URL}/account`,
  resourceAccess: (resourceKey: string) => `${BASE_URL}/resources/${encodeURIComponent(resourceKey)}/access`,
  topbarData: () => `${BASE_URL}/site/pvt/newtopbar`,
  listBindings: (tenant: string) => `${BASE_URL}/binding/site/${encodeURIComponent(tenant)}`,
  getBinding: (bindingId: string) => `${BASE_URL}/binding/${encodeURIComponent(bindingId)}`,
  createBinding: () => `${BASE_URL}/binding`,
  deleteBinding: (bindingId: string) => `${BASE_URL}/binding/${encodeURIComponent(bindingId)}`,
  updateBinding: (bindingId: string) => `${BASE_URL}/binding/${bindingId}`,
}

export class LicenseManager extends JanusClient {
  public getAccountData(VtexIdclientAutCookie: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'lm-account-data'
    return this.http.get(routes.accountData(), {
      forceMaxAge: TWO_MINUTES_S,
      headers: {
        VtexIdclientAutCookie,
      },
      inflightKey: inflightUrlWithQuery,
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getTopbarData(VtexIdclientAutCookie: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'lm-topbar-data'
    return this.http.get(routes.topbarData(), {
      headers: {
        VtexIdclientAutCookie,
      },
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public canAccessResource(VtexIdclientAutCookie: string, resourceKey: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'lm-resource-access'
    return this.http
      .get(routes.resourceAccess(resourceKey), {
        headers: {
          VtexIdclientAutCookie,
        },
        metric,
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      })
      .then(
        () => true,
        () => false
      )
  }

  public listBindings = ({ tenant, adminUserAuthToken }: OptionsListBindings, config?: RequestConfig) => {
    const metric = 'lm-list-bindings'
    return this.http.get<APIBindingRes[]>(routes.listBindings(tenant), {
      inflightKey: inflightUrlWithQuery,
      memoizeable: true,
      metric,
      headers: {
        VtexIdclientAutCookie: adminUserAuthToken,
      },
      ...config,
      tracing: {
        requestSpanNameSuffix: metric,
        ...config?.tracing,
      },
    })
  }

  public getBinding = ({ adminUserAuthToken, bindingId }: OptionsGetBinding, config?: RequestConfig) => {
    const metric = 'lm-get-binding'
    return this.http.get<APIBindingRes>(routes.getBinding(bindingId), {
      inflightKey: inflightUrlWithQuery,
      memoizeable: true,
      metric,
      headers: {
        VtexIdclientAutCookie: adminUserAuthToken,
      },
      ...config,
      tracing: {
        requestSpanNameSuffix: metric,
        ...config?.tracing,
      },
    })
  }

  public createBinding = (
    {
      tenant,
      adminUserAuthToken,
      defaultLocale,
      supportedLocales,
      salesChannelId,
      addrs,
      canonicalAddr,
    }: OptionsCreateBinding,
    config?: RequestConfig
  ) => {
    const metric = 'lm-create-binding'

    if (addrs.length === 0) {
      throw new Error('A binding must have at least one address')
    }

    const canonicalAddrExists = addrs.some(
      (addr) => canonicalAddr.host === addr.host && canonicalAddr.path === addr.path
    )

    if (!canonicalAddrExists) {
      throw new Error('The canonical address must exist within the address list')
    }

    if (supportedLocales.length === 0) {
      throw new Error('A binding must have at least one locale')
    }

    const defaultLocaleExists = supportedLocales.some((locale) => defaultLocale === locale)

    if (!defaultLocaleExists) {
      throw new Error('The default locale must exist within the supported locales')
    }

    const bindingObj: APIBindingCreate = {
      SiteName: tenant,
      DefaultLocale: defaultLocale,
      SupportedLocales: supportedLocales,
      DefaultSalesChannelId: salesChannelId,
      Addresses: addrs.map((addr: Addr) => ({
        Host: addr.host,
        BasePath: addr.path,
        IsCanonical: canonicalAddr.host === addr.host && canonicalAddr.path === addr.path,
        Localization: {
          '': defaultLocale,
        },
      })),
    }

    return this.http.post<APICreateBindingRes>(routes.createBinding(), bindingObj, {
      inflightKey: inflightUrlWithQuery,
      metric,
      headers: {
        VtexIdclientAutCookie: adminUserAuthToken,
      },
      ...config,
      tracing: {
        requestSpanNameSuffix: metric,
        ...config?.tracing,
      },
    })
  }

  public deleteBinding = ({ adminUserAuthToken, bindingId }: OptionsDeleteBinding, config?: RequestConfig) => {
    const metric = 'lm-delete-binding'

    return this.http.delete(routes.deleteBinding(bindingId), {
      inflightKey: inflightUrlWithQuery,
      metric,
      headers: {
        VtexIdclientAutCookie: adminUserAuthToken,
      },
      ...config,
      tracing: {
        requestSpanNameSuffix: metric,
        ...config?.tracing,
      },
    })
  }

  public updateBinding = (
    {
      tenant,
      adminUserAuthToken,
      bindingId,
      defaultLocale,
      supportedLocales,
      salesChannelId,
      addrs,
      canonicalAddr,
    }: OptionsUpdateBinding,
    config?: RequestConfig
  ) => {
    const metric = 'lm-update-binding'

    if (addrs.length === 0) {
      throw new Error('A binding must have at least one address')
    }

    const canonicalAddrExists = addrs.some(
      (addr) => canonicalAddr.host === addr.host && canonicalAddr.path === addr.path
    )

    if (!canonicalAddrExists) {
      throw new Error('The canonical address must exist within the address list')
    }

    if (supportedLocales.length === 0) {
      throw new Error('A binding must have at least one locale')
    }

    const defaultLocaleExists = supportedLocales.some((locale) => defaultLocale === locale)

    if (!defaultLocaleExists) {
      throw new Error('The default locale must exist within the supported locales')
    }

    const bindingObj: APIBindingUpdate = {
      Id: bindingId,
      SiteName: tenant,
      DefaultLocale: defaultLocale,
      SupportedLocales: supportedLocales,
      DefaultSalesChannelId: salesChannelId,
      Addresses: addrs.map((addr: Addr) => ({
        Host: addr.host,
        BasePath: addr.path,
        IsCanonical: canonicalAddr.host === addr.host && canonicalAddr.path === addr.path,
        Localization: {
          '': defaultLocale,
        },
      })),
    }

    return this.http.put(routes.updateBinding(bindingId), bindingObj, {
      inflightKey: inflightUrlWithQuery,
      metric,
      headers: {
        VtexIdclientAutCookie: adminUserAuthToken,
      },
      ...config,
      tracing: {
        requestSpanNameSuffix: metric,
        ...config?.tracing,
      },
    })
  }
}
