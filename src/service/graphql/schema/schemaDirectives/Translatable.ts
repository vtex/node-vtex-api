import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { map } from 'ramda'

import { IOClients } from '../../../../clients/IOClients'
import { ServiceContext } from '../../../typings'
import { messagesLoader } from '../messagesLoader'

export class Translatable extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { behavior = 'FULL' } = this.args
    field.resolve = async (root, args, context, info) => {
      const { clients: { segment }, clients, vtex: { locale } } = context
      if (!context.loaders || !context.loaders.messages) {
        context.loaders = {
          ...context.loaders,
          messages: messagesLoader(clients),
        }
      }

      const response = await resolve(root, args, context, info)

      return !Array.isArray(response) ? handleSingleString(response, context) : map((element: any) => handleSingleString(element, context), response)
    }
  }
}

const handleSingleString = async (response: any, context: ServiceContext<IOClients, void, void>) => {
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

  const { clients: { segment } } = context
  const { cultureInfo: to } = await segment.getSegment()

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
