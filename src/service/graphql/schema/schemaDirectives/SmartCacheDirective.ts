import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { maxAgeEnums } from '../../utils/maxAgeEnum'

export const ETAG_CONTROL_HEADER = 'x-vtex-etag-control'

interface Args {
  maxAge: keyof typeof maxAgeEnums | undefined
}

const DEFAULT_ARGS: Args = {
  maxAge: undefined,
}

export class SmartCacheDirective extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, any>) {
    const {resolve = defaultFieldResolver} = field
    const { maxAge } = this.args as Args || DEFAULT_ARGS
    const maxAgeS = maxAge && maxAgeEnums[maxAge]
    field.resolve = (root, args, context, info) => {
      if (maxAgeS) {
        context.set(ETAG_CONTROL_HEADER, maxAgeS)
      }
      context.vtex.recorder = context.state.recorder
      return resolve(root, args, context, info)
    }
  }
}
