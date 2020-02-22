import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { GraphQLServiceContext } from '../../typings'

interface CacheControlArgs {
  maxAge: number
  scope: 'PRIVATE' | 'SEGMENT' | 'PUBLIC'
}

export class CacheControl extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, GraphQLServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { maxAge: directiveMaxAge, scope: directiveScope } = this.args as CacheControlArgs

    field.resolve = (root, args, ctx, info) => {
      const { maxAge, scope } = ctx.graphql.cacheControl

      if (Number.isInteger(directiveMaxAge) && directiveMaxAge < maxAge) {
        ctx.graphql.cacheControl.maxAge = directiveMaxAge
      }

      if (directiveScope === 'PRIVATE') {
        ctx.graphql.cacheControl.scope = 'private'
      } else if (directiveScope === 'SEGMENT' && scope === 'public') {
        ctx.graphql.cacheControl.scope = 'segment'
      }

      return resolve(root, args, ctx, info)
    }
  }
}

export const cacheControlDirectiveTypeDefs = `

enum IOCacheControlScope {
  SEGMENT
  PUBLIC
  PRIVATE
}

directive @cacheControl(
  maxAge: Int
  scope: IOCacheControlScope
) on FIELD_DEFINITION
`
