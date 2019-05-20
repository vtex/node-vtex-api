import { IOContext } from '../service/typings'
import { GraphQLClient } from './GraphQLClient'
import { IOClient } from './IOClient'
import { InstanceOptions } from './typings'

/**
 * A GraphQL client that can be instantiated by the Service runtime layer.
 */
export class IOGraphQLClient extends IOClient {
  protected graphql: GraphQLClient

  constructor(protected context: IOContext, protected options?: InstanceOptions) {
    super(context, options)
    this.graphql = new GraphQLClient(this.http)
  }
}
