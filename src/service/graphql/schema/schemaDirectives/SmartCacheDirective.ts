import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

export class SmartCacheDirective extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, any>) {
    const {resolve = defaultFieldResolver} = field
    field.resolve = (root, args, context, info) => {
      context.vtex.recorder = context.state.recorder
      return resolve(root, args, context, info)
    }
  }
}
