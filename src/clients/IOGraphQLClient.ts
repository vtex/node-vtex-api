import { GraphQLClient } from '../HttpClient/GraphQLClient'
import { InstanceOptions } from '../HttpClient/typings'
import { IOContext } from '../service/worker/runtime/typings'
import { IOClient } from './IOClient'

/**
 * A GraphQL client that can be instantiated by the Serviceruntime layer.
 */
export class IOGraphQLClient extends IOClient {
  protected graphql: GraphQLClient

  constructor(protected context: IOContext, protected options?: InstanceOptions) {
    super(context, options)
    this.graphql = new GraphQLClient(this.http)
  }
}
