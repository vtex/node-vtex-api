import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { Behavior } from '../../../../../../clients'

import { ServiceContext } from '../../../typings'
import { handleSingleString } from '../../utils/translations'
import { createMessagesLoader } from '../messagesLoaderV2'

interface Args {
  behavior: Behavior
  language: string
}

export class TranslateTo extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { language, behavior = 'FULL' } = this.args as Args
    field.resolve = async (root, args, ctx, info) => {
      if (!ctx.loaders?.immutableMessagesV2) {
        const dependencies = await ctx.clients.apps.getAppsMetaInfos()
        ctx.loaders = {
          ...ctx.loaders,
          immutableMessagesV2: createMessagesLoader(ctx.clients, language, dependencies),
        }
      }
      const response = (await resolve(root, args, ctx, info)) as string | string[] | null
      const {
        vtex,
        loaders: { immutableMessagesV2 },
      } = ctx
      const handler = handleSingleString(vtex, immutableMessagesV2!, behavior, 'translateTo')
      return Array.isArray(response) ? Promise.all(response.map(handler)) : handler(response)
    }
  }
}

export const translateToDirectiveTypeDefs = `
directive @translateTo(
  language: String!
  behavior: String
) on FIELD_DEFINITION
`
