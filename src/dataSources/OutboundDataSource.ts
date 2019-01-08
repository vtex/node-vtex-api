import { RESTDataSource } from 'apollo-datasource-rest'
import { BodyInit, Headers, RequestInit, URLSearchParamsInit } from 'apollo-server-env'
import { ServiceContext } from '../HttpClient'

type Body = BodyInit | object

export class OutboundDataSource<T extends ServiceContext> extends RESTDataSource<T> {
  protected modifiers: Modifier[] = []

  protected get = async <TResult = any>(
    path: string,
    params?: URLSearchParamsInit,
    init?: RequestInit,
  ): Promise<TResult> =>
    super.get<TResult>(path, params, this.modify(init))

  protected post = async <TResult = any>(
    path: string,
    body?: Body,
    init?: RequestInit,
  ): Promise<TResult> =>
    super.post<TResult>(path, body, this.modify(init))

  protected patch = async <TResult = any>(
    path: string,
    body?: Body,
    init?: RequestInit,
  ): Promise<TResult> =>
    super.patch<TResult>(path, body, this.modify(init))

  protected put = async <TResult = any>(
    path: string,
    body?: Body,
    init?: RequestInit,
  ): Promise<TResult> =>
    super.put<TResult>(path, body, this.modify(init))

  protected delete = async <TResult = any>(
    path: string,
    params?: URLSearchParamsInit,
    init?: RequestInit,
  ): Promise<TResult> =>
    super.delete<TResult>(path, params, this.modify(init))

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
