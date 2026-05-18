import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { Behavior } from '../../../../../../clients'

import { ServiceContext } from '../../../typings'
import { handleSingleString } from '../../utils/translations'
import { createMessagesLoader } from '../messagesLoaderV2'

interface Args {
  behavior: Behavior
  withAppsMetaInfo: boolean
}

export class TranslatableV2 extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { behavior = 'FULL', withAppsMetaInfo = false } = this.args as Args
    field.resolve = async (root, args, ctx, info) => {
      if (!ctx.loaders?.messagesV2) {
        const { vtex: { locale: to } } = ctx

        if (to == null) {
          throw new Error('@translatableV2 directive needs the locale variable available in IOContext. You can do this by either setting \`ctx.vtex.locale\` directly or calling this app with \`x-vtex-locale\` header')
        }

        const dependencies = withAppsMetaInfo ? await ctx.clients.apps.getAppsMetaInfos() : undefined
        ctx.loaders = {
          ...ctx.loaders,
          messagesV2: createMessagesLoader(ctx.clients, to, dependencies),
        }
      }
      const response = await resolve(root, args, ctx, info) as string | string[] | null
      const { vtex, loaders: { messagesV2 } } = ctx
      const handler = handleSingleString(vtex, messagesV2!, behavior, 'translatableV2')
      return Array.isArray(response)
        ? Promise.all(response.map(handler))
        : handler(response)
    }
  }
}

export const translatableV2DirectiveTypeDefs = `
directive @translatableV2(
  behavior: String
  withAppsMetaInfo: Boolean
) on FIELD_DEFINITION
`
