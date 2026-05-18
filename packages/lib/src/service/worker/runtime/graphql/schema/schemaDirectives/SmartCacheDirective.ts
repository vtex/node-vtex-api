import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { MAX_AGE } from '../../../../../../constants'

const ETAG_CONTROL_HEADER = 'x-vtex-etag-control'

interface Args {
  maxAge: keyof typeof MAX_AGE | undefined
}

const DEFAULT_ARGS: Args = {
  maxAge: undefined,
}

export class SmartCacheDirective extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, any>) {
    const {resolve = defaultFieldResolver} = field
    const { maxAge } = this.args as Args || DEFAULT_ARGS
    const maxAgeS = maxAge && MAX_AGE[maxAge]
    field.resolve = (root, args, context, info) => {
      if (maxAgeS) {
        context.set(ETAG_CONTROL_HEADER, `public, max-age=${maxAgeS}`)
      }
      context.vtex.recorder = context.state.recorder
      return resolve(root, args, context, info)
    }
  }
}

export const smartCacheDirectiveTypeDefs = `
directive @smartcache(
  maxAge: String
) on FIELD_DEFINITION
`
