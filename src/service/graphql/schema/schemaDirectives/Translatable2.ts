import { map } from 'bluebird'
import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { IOClients } from '../../../../clients/IOClients'
import { ServiceContext } from '../../../typings'
import { messagesLoader2 } from '../messagesLoader'

export class Translatable2 extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { behavior = 'FULL', context = 'default' } = this.args
    field.resolve = async (root, args, ctx, info) => {
      const { clients: { segment }, clients } = ctx
      if (!ctx.loaders || !ctx.loaders.messages) {
        ctx.loaders = {
          ...ctx.loaders,
          messages: messagesLoader2(clients),
        }
      }
      const response = await resolve(root, args, ctx, info)
      const handler = handleSingleString(ctx, behavior, context)
      return Array.isArray(response) ? await map(response, handler) : await handler(response)
    }
  }
}

const handleSingleString = (ctx: ServiceContext<IOClients, void, void>, behavior: string, context: string) => async (response: any) => {
  // Messages only knows how to process non empty strings.
  if ((typeof response !== 'string' && typeof response !== 'object') || Array.isArray(response) || response == null) {
    return response
  }
  const resObj = typeof response === 'string'
    ? {
      content: response,
      context,
      description: '',
      from: undefined,
    }
    : response

  const { content, from } = resObj
  const { clients: { segment }, vtex: { locale } } = ctx

  const to =
    locale != null
    ? locale
    : (await segment.getSegment()).cultureInfo

  if (content == null) {
    throw new Error(`@translatable directive needs a content to translate, but received ${JSON.stringify(response)}`)
  }

  // If the message is already in the target locale, return the content.
  if (!to || from === to) {
    return content
  }

  return ctx.loaders.messages!.load({
    ...resObj,
    behavior,
    from,
    to,
  })
}
