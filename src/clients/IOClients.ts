import { pickAll } from 'ramda'

import { Apps, Billing, Builder, Events, ID, Logger, Messages, Metadata, Registry, Router, Segment, VBase, Workspaces } from '.'
import { InstanceOptions } from '../HttpClient'
import { ClientContext, ClientDependencies, ClientInstanceOptions, IOContext } from '../service/typings'
import { AppAssets } from './AppAssets'
import { IOClient } from './IOClient'
import { IOClientHTTP } from './IOClientHTTP'

export type IOClientFactory = new (context: ClientContext, options?: InstanceOptions) => IOClient

function hasDependencies<T extends IOClients>(instanceOptions: ClientInstanceOptions<T>): instanceOptions is ClientInstanceOptions<T> {
  return typeof (instanceOptions as ClientDependencies<T>).depends !== 'undefined'
}

export type ClientsImplementation<T extends IOClients> = new (
  clientOptions: Record<string, ClientInstanceOptions>,
  ctx: IOContext
) => T

export class IOClients {
  private clients: Record<string, IOClientHTTP | any> = {}

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

  public get builder() {
    return this.getOrSet('builder', Builder)
  }

  public get events() {
    return this.getOrSet('events', Events)
  }

  public get id() {
    return this.getOrSet('id', ID)
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

  public get vbase() {
    return this.getOrSet('vbase', VBase)
  }

  public get workspaces() {
    return this.getOrSet('workspaces', Workspaces)
  }

  public get appAssets() {
    return this.getOrSet('appAssets', AppAssets)
  }

  protected getOrSet<TClient extends IOClientFactory>(key: string, Implementation: TClient): InstanceType<TClient> {
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
