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
      if (!ctx.loaders?.messagesV2Manual) {
        const dependencies = await ctx.clients.apps.getAppsMetaInfos()
        ctx.loaders = {
          ...ctx.loaders,
          messagesV2Manual: createMessagesLoader(ctx.clients, language, dependencies),
        }
      }
      const response = (await resolve(root, args, ctx, info)) as string | string[] | null
      const {
        vtex,
        loaders: { messagesV2Manual },
      } = ctx
      const handler = handleSingleString(vtex, messagesV2Manual!, behavior, 'translatableV2')
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
