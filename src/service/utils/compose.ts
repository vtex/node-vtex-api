import koaCompose from 'koa-compose'

import { IOClients } from '../../clients/IOClients'
import { timer } from '../../utils/time'
import { EventHandler, RouteHandler } from '../typings'

export const compose = <ClientsT extends IOClients, StateT, CustomT>(middlewares: Array<RouteHandler<ClientsT, StateT, CustomT>>) =>
  koaCompose(middlewares.map(timer))

export const eventCompose = <ClientsT extends IOClients, StateT, CustomT>(middlewares: Array<EventHandler<ClientsT, StateT, CustomT>>) =>
  koaCompose(middlewares.map(timer))
