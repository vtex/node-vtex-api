import { IOClients } from '../clients/IOClients'
import { ServiceConfig } from './typings'

/**
 * This is the client definition to allow type checking on code editors.
 * In you `index.ts`, you must `export default new Service({...})` with your
 * client options, implementation and route handlers.
 *
 * @export
 * @class Service
 * @template ClientsT Your Clients implementation that extends IOClients and adds extra clients.
 * @template StateT The state bag in `ctx.state`
 * @template CustomT Any custom fields in `ctx`. THIS IS NOT RECOMMENDED. Use StateT instead.
 */
export class Service<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void>{
  constructor(public config: ServiceConfig<ClientsT, StateT, CustomT>) {
    if (config.routes && config.routes.graphql) {
      throw new Error('Route id "graphql" is reserved. To create a GraphQL app, export a "graphql" key with {resolvers}.')
    }
  }
}
