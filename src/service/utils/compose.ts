import koaCompose from 'koa-compose'

import { IOClients } from '../../clients/IOClients'
import { timer } from '../../utils/time'
import { RouteHandler } from '../typings'

export const compose = <ClientsT extends IOClients, StateT, CustomT>(middlewares: Array<RouteHandler<ClientsT, StateT, CustomT>>) =>
  koaCompose(middlewares.map(timer))
