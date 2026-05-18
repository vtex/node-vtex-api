import koaCompose from 'koa-compose'
import { pipe } from 'ramda'

import { IOClients } from '@vtex/api'
import { cancel } from '@vtex/api'
import { timer, timerForEvents } from '@vtex/api'
import {
  EventHandler,
  ParamsContext,
  RecorderState,
  RouteHandler,
} from '@vtex/api'

export const compose = <ClientsT extends IOClients, StateT extends RecorderState, CustomT extends ParamsContext>(middlewares: Array<RouteHandler<ClientsT, StateT, CustomT>>) =>
  koaCompose(middlewares.map(pipe(timer, cancel)))

export const composeForEvents = <ClientsT extends IOClients, StateT extends RecorderState>(middlewares: Array<EventHandler<ClientsT, StateT>>) =>
  koaCompose(middlewares.map(timerForEvents))
