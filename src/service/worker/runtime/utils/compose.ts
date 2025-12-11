import koaCompose from 'koa-compose'
import { pipe } from 'ramda'

import { IOClients } from '../../../../clients/IOClients'
import { cancel } from '../../../../utils/cancel'
import { timer, timerForEvents } from '../../../../utils/time'
import {
  EventHandler,
  ParamsContext,
  RecorderState,
  RouteHandler,
} from '../typings'

export const compose = <ClientsT extends IOClients, StateT extends RecorderState, CustomT extends ParamsContext>(middlewares: RouteHandler<ClientsT, StateT, CustomT>[]) =>
  koaCompose(middlewares.map(pipe(timer, cancel)))

export const composeForEvents = <ClientsT extends IOClients, StateT extends RecorderState>(middlewares: EventHandler<ClientsT, StateT>[]) =>
  koaCompose(middlewares.map(timerForEvents))
