import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { prop } from 'ramda'

import { ServiceContext } from '../../../typings'
import { messagesLoader } from '../messagesLoader'

export class Translatable extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    field.resolve = async (root, args, context, info) => {
      const { clients: { segment }, clients } = context
      if (!context.loaders || !context.loaders.messages) {
        context.loaders = {
          ...context.loaders,
          messages: messagesLoader(clients),
        }
      }

      const response = await resolve(root, args, context, info)

      const resObj = typeof response === 'string'
        ? {
          content: response,
          description: '',
          from: undefined,
          id: response,
        }
        : response
      const { content, from } = resObj
      const to = await segment.getSegment().then(prop('cultureInfo'))

      // If the message is already in the target locale, return the content.
      if (!to || from === to) {
        return content
      }

      return context.loaders.messages!.load({
        ...resObj,
        from,
        to,
      })
    }
  }
}
