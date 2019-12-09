import { map } from 'bluebird'
import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { IOClients } from '../../../../clients/IOClients'
import { ServiceContext } from '../../../typings'
import { messagesLoader } from '../messagesLoader'

export class Translatable extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { behavior = 'FULL' } = this.args
    field.resolve = async (root, args, context, info) => {
      const { clients: { segment }, clients, vtex: { logger }} = context
      if (Math.random() < 0.1) {
        logger.warn(`Translatable directive in use by: ${context.vtex.account} (Operation Id: ${context.vtex.operationId})`)
      }
      if (!context.loaders || !context.loaders.messages) {
        context.loaders = {
          ...context.loaders,
          messages: messagesLoader(clients),
        }
      }
      const response = await resolve(root, args, context, info)
      const handler = handleSingleString(context, behavior)
      return Array.isArray(response) ? await map(response, handler) : await handler(response)
    }
  }
}

const handleSingleString = (context: ServiceContext<IOClients, void, void>, behavior: string) => async (response: any) => {
  // Messages only knows how to process non empty strings.
  if ((typeof response !== 'string' && typeof response !== 'object') || Array.isArray(response) || response == null) {
    return response
  }
  const resObj = typeof response === 'string'
    ? {
      content: response,
      description: '',
      from: undefined,
      id: response,
    }
    : response

  const { content, from, id } = resObj
  const { clients: { segment }, vtex: { locale } } = context

  const to =
    locale != null
    ? locale
    : (await segment.getSegment()).cultureInfo

  if (content == null && id == null) {
    throw new Error(`@translatable directive needs a content or id to translate, but received ${JSON.stringify(response)}`)
  }

  // If the message is already in the target locale, return the content.
  if (!to || from === to) {
    return content
  }

  return context.loaders.messages!.load({
    ...resObj,
    behavior,
    from,
    to,
  })
}
