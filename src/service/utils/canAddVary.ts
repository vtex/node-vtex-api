import { IOClients } from '../../clients/IOClients'
import { ServiceContext } from '../typings'

export function canAddVary <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>): boolean {
  const varyHeader = ctx.response.get('vary')
  return !!varyHeader && varyHeader.toLowerCase() === 'accept-encoding'
}
