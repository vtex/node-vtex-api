import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { ETAG_CONTROL_HEADER } from './SmartCacheDirective'

const DEFAULT_ARGS = {
  maxAge: undefined,
}

export class DinamycSmartCache extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, any>) {
    const {resolve = defaultFieldResolver} = field

    field.resolve = async (root, args, context, info) => {  
      const response = await resolve(root, args, context, info)

      const { maxAge } = response || DEFAULT_ARGS
      if(maxAge){
        context.set(ETAG_CONTROL_HEADER, maxAge)
        context.vtex.recorder = context.state.recorder
      }

      return response
    }
  }
}
