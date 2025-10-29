import { InstanceOptions } from '../HttpClient'
import { IOContext } from '../service/worker/runtime/typings'
import { Billing, Builder, MessagesGraphQL, Settings } from './apps'
import { CatalogGraphQL } from './apps/catalogGraphQL/index'
import { ID, MasterData, PaymentProvider } from './external'
import { Apps, Assets, BillingMetrics, Events, Registry, Router, VBase, Workspaces } from './infra'
import { IOClient, IOClientConstructor } from './IOClient'
import { LicenseManager, Segment, Session, TenantClient, Catalog } from './janus'

export type ClientsImplementation<T extends IOClients> = new (
  clientOptions: Record<string, InstanceOptions>,
  ctx: IOContext
) => T

export class IOClients {
  private clients: Record<string, IOClient> = {}

  constructor(private clientOptions: Record<string, InstanceOptions>, private ctx: IOContext) {}

  public get apps() {
    return this.getOrSet('apps', Apps)
  }

  public get assets() {
    return this.getOrSet('assets', Assets)
  }

  public get billing() {
    return this.getOrSet('billing', Billing)
  }

  public get billingMetrics() {
    return this.getOrSet('billingMetrics', BillingMetrics)
  }

  public get builder() {
    return this.getOrSet('builder', Builder)
  }

  public get events() {
    return this.getOrSet('events', Events)
  }

  public get id() {
    return this.getOrSet('id', ID)
  }

  public get licenseManager() {
    return this.getOrSet('licenseManager', LicenseManager)
  }

  public get masterdata() {
    return this.getOrSet('masterdata', MasterData)
  }

  public get messagesGraphQL() {
    return this.getOrSet('messagesGraphQL', MessagesGraphQL)
  }

  public get registry() {
    return this.getOrSet('registry', Registry)
  }

  public get router() {
    return this.getOrSet('router', Router)
  }

  public get segment() {
    return this.getOrSet('segment', Segment)
  }

  public get settings() {
    return this.getOrSet('settings', Settings)
  }

  public get session() {
    return this.getOrSet('session', Session)
  }

  public get tenant() {
    return this.getOrSet('tenant', TenantClient)
  }

  public get vbase() {
    return this.getOrSet('vbase', VBase)
  }

  public get workspaces() {
    return this.getOrSet('workspaces', Workspaces)
  }

  public get catalogGraphQL() {
    return this.getOrSet('catalogGraphQL', CatalogGraphQL)
  }

  public get catalog() {
    return this.getOrSet('catalog', Catalog)
  }

  public get paymentProvider() {
    return this.getOrSet('paymentProvider', PaymentProvider)
  }

  protected getOrSet<TClient extends IOClientConstructor>(key: string, Implementation: TClient): InstanceType<TClient> {
    const options = {
      ...this.clientOptions.default,
      ...this.clientOptions[key],
      metrics,
    }

    if (!this.clients[key]) {
      this.clients[key] = new Implementation(this.ctx, options)
    }

    return this.clients[key] as InstanceType<TClient>
  }
}
