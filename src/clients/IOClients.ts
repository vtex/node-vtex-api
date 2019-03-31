import { InstanceOptions } from '../HttpClient'
import { IODataSource } from '../IODataSource'
import { ClientsConfigOptions, IOContext, } from '../service/typings'
import { Apps, Billing, Builder, Events, ID, Logger, Messages, Metadata, Registry, Router, Segment, VBase, Workspaces } from './index'

export type IOClient = new (context: IOContext, options: InstanceOptions) => IODataSource | Builder | ID | Router
export type ClientsImplementation<T extends IOClients> = new (
  clientOptions: ClientsConfigOptions<T>,
  ctx: IOContext
) => T

export class IOClients {
  private clients: Record<string, IODataSource | any> = {}

  constructor(
    private clientOptions: ClientsConfigOptions<IOClients>,
    private ctx: IOContext
  ) { }

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

  public get messages(): Messages {
    return this.getOrSet('messages', Messages)
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

  public get segment(): Segment {
    return this.getOrSet('segment', Segment)
  }

  public get vbase(): VBase {
    return this.getOrSet('vbase', VBase)
  }

  public get workspaces(): Workspaces {
    return this.getOrSet('workspaces', Workspaces)
  }

  protected getOrSet(key: keyof ClientsConfigOptions<IOClients>, Implementation: IOClient) {
    const options = {
      ...this.clientOptions.default,
      ...this.clientOptions[key],
      metrics,
    }

    if (!this.clients[key]) {
      this.clients[key] = new Implementation(this.ctx, options)
    }

    return this.clients[key]
  }
}
