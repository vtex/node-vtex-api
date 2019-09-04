import { map } from 'bluebird'
import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { IOClients } from '../../../../clients/IOClients'
import { ServiceContext } from '../../../typings'
import { messagesLoaderV2 } from '../messagesLoaderV2'

export class TranslatableV2 extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { behavior = 'FULL', context = 'default' } = this.args
    field.resolve = async (root, args, ctx, info) => {
      if (!ctx.loaders || !ctx.loaders.messagesV2) {
        ctx.loaders = {
          ...ctx.loaders,
          messagesV2: messagesLoaderV2(ctx.clients),
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
      description: '',
      from: undefined,
    }
    : response

  const { content, from } = resObj
  const { clients: { segment }, vtex: { locale } } = ctx

  if (content == null) {
    throw new Error(`@translatable directive needs a content to translate, but received ${JSON.stringify(response)}`)
  }

  const to =
    locale != null
    ? locale
    : (await segment.getSegment()).cultureInfo

  // If the message is already in the target locale, return the content.
  if (!to || from === to) {
    return content
  }

  return ctx.loaders.messagesV2!.load({
    behavior,
    context,
    from,
    to,
    ...resObj,
  })
}

