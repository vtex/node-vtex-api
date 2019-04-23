import { pickAll } from 'ramda'
import { InstanceOptions } from '../HttpClient'
import { IODataSource } from '../IODataSource'
import { ClientContext, ClientDependencies, ClientInstanceOptions, IOContext } from '../service/typings'
import { Apps, Billing, BillingMetrics, Builder, Events, ID, LicenseManager, Logger, Messages, Metadata, Registry, Router, Segment, Session, VBase, Workspaces } from './index'

export type IOClient = new (context: ClientContext, options: InstanceOptions) => IODataSource | Builder | ID | Router

function hasDependencies<T extends IOClients>(instanceOptions: ClientInstanceOptions<T>): instanceOptions is ClientInstanceOptions<T> {
  return typeof (instanceOptions as ClientDependencies<T>).depends !== 'undefined'
}

export type ClientsImplementation<T extends IOClients> = new (
  clientOptions: Record<string, ClientInstanceOptions>,
  ctx: IOContext
) => T

export class IOClients {
  private clients: Record<string, IODataSource | any> = {}

  constructor(
    private clientOptions: Record<string, ClientInstanceOptions>,
    private ctx: IOContext
  ) { }

  public get apps() {
    return this.getOrSet('apps', Apps)
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

  public get logger() {
    return this.getOrSet('logger', Logger)
  }

  public get messages() {
    return this.getOrSet('messages', Messages)
  }

  public get metadata() {
    return this.getOrSet('metadata', Metadata)
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

  public get session() {
    return this.getOrSet('session', Session)
  }

  public get vbase() {
    return this.getOrSet('vbase', VBase)
  }

  public get workspaces() {
    return this.getOrSet('workspaces', Workspaces)
  }

  protected getOrSet<TClient extends IOClient>(key: string, Implementation: TClient): InstanceType<TClient> {
    const options = {
      ...this.clientOptions.default,
      ...this.clientOptions[key],
      metrics,
    }

    const clients =
      hasDependencies(options)
      && options.depends
      && pickAll(options.depends.clients, this) || {} // deal with circular dependency

    if (!this.clients[key]) {
      this.clients[key] = new Implementation({ ... this.ctx, clients }, options)
    }


    return this.clients[key]
  }
}
