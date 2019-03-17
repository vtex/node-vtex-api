import { InstanceOptions } from '../HttpClient'
import { IODataSource } from '../IODataSource'
import { IOContext, ServiceContext } from '../service/typings'
import { Apps, Billing, Builder, Events, ID, Logger, Metadata, Registry, Router, VBase, Workspaces } from './index'

type IOClient = new(context: IOContext, options: InstanceOptions) => IODataSource | Builder | ID | Router

export type ClientsImplementation<T extends IOClients> = new(
    clientOptions: Record<string, InstanceOptions>,
    ctx: ServiceContext<T>
  ) => T

export class IOClients {
  [client: string]: IODataSource | any

  constructor (
    private clientOptions: Record<string, InstanceOptions>,
    private ctx: ServiceContext
  ) {}

  public get apps(): Apps {
    return this.getOrSet('apps', Apps)
  }

  public get billing(): Billing {
    return this.getOrSet('billing', Billing)
  }

  public get builder(): Builder {
    return this.getOrSet('builder', Builder)
  }

  public get events(): Events {
    return this.getOrSet('events', Events)
  }

  public get id(): ID {
    return this.getOrSet('id', ID)
  }

  public get logger(): Logger {
    return this.getOrSet('logger', Logger)
  }

  public get metadata(): Metadata {
    return this.getOrSet('metadata', Metadata)
  }

  public get registry(): Registry {
    return this.getOrSet('registry', Registry)
  }

  public get router(): Router {
    return this.getOrSet('router', Router)
  }

  public get vbase(): VBase {
    return this.getOrSet('vbase', VBase)
  }

  public get workspaces(): Workspaces {
    return this.getOrSet('workspaces', Workspaces)
  }

  protected getOrSet(key: string, Implementation: IOClient) {
    const options = {
      ...this.clientOptions.default,
      ...this.clientOptions[key],
    }

    if (!this[key]) {
      this[key] = new Implementation(this.ctx.vtex, options)
    }

    return this[key]
  }
}
