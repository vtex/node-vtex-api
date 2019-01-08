import { RESTDataSource } from 'apollo-datasource-rest'
import { BodyInit, Headers, RequestInit, URLSearchParamsInit } from 'apollo-server-env'
import { ServiceContext } from '../HttpClient'

type Body = BodyInit | object

export class OutboundDataSource<T extends ServiceContext> extends RESTDataSource<T> {
  protected modifiers: Modifier[] = []

  protected async get <TResult = any>(
    path: string,
    params?: URLSearchParamsInit,
    init?: RequestInit,
  ): Promise<TResult> {
    return super.get<TResult>(path, params, this.modify(init))
  }

  protected async post <TResult = any>(
    path: string,
    body?: Body,
    init?: RequestInit,
  ): Promise<TResult> {
    return super.post<TResult>(path, body, this.modify(init))
  }

  protected async patch <TResult = any>(
    path: string,
    body?: Body,
    init?: RequestInit,
  ): Promise<TResult> {
    return super.patch<TResult>(path, body, this.modify(init))
  }

  protected async put <TResult = any>(
    path: string,
    body?: Body,
    init?: RequestInit,
  ): Promise<TResult> {
    return super.put<TResult>(path, body, this.modify(init))
  }

  protected async delete <TResult = any>(
    path: string,
    params?: URLSearchParamsInit,
    init?: RequestInit,
  ): Promise<TResult> {
    return super.delete<TResult>(path, params, this.modify(init))
  }

  private modify = (init?: RequestInit) => {
    const options: ModOptions = init as ModOptions || {} as ModOptions
    options.headers = options.headers && options.headers instanceof Headers
      ? options.headers
      : new Headers(options.headers)
    options.baseURL = this.baseURL

    return this.modifiers.reduce(
      (previous: ModOptions, modifier: Modifier) => modifier(previous, this.context),
      options,
    )
  }
}

export type ModOptions = RequestInit & {
  headers: Headers
  baseURL?: string,
}

export type Modifier = <T extends ServiceContext> (options: ModOptions, context: T) => ModOptions
