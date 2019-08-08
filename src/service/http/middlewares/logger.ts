import { IOClients } from '../../../clients/IOClients'
import { Logger } from '../../logger'
import { ServiceContext } from '../../typings'

export async function logger<T extends IOClients, U, V>(ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  ctx.vtex.logger = new Logger(ctx.vtex)
  await next()
}
