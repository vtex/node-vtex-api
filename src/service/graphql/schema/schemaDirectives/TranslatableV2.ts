import { map } from 'bluebird'
import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { Behavior } from '../../../../clients'
import { IOClients } from '../../../../clients/IOClients'
import { ServiceContext } from '../../../typings'
import { messagesLoaderV2 } from '../messagesLoaderV2'

const CONTEXT_LEFT_DELIMITER = '((('
const CONTEXT_RIGHT_DELIMITER = ')))'
const FROM_LEFT_DELIMITER = '<<<'
const FROM_RIGHT_DELIMITER = '>>>'


export class TranslatableV2 extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { behavior = 'FULL' } = this.args
    field.resolve = async (root, args, ctx, info) => {
      if (!ctx.loaders || !ctx.loaders.messagesV2) {
        ctx.loaders = {
          ...ctx.loaders,
          messagesV2: messagesLoaderV2(ctx.clients),
        }
      }
      const response = await resolve(root, args, ctx, info) as string | string[] | null
      const handler = handleSingleString(ctx, behavior)
      return Array.isArray(response) ? await map(response, handler) : await handler(response)
    }
  }
}

export interface TranslatableMessageV2 {
  from: string
  content: string
  context?: string
}

const parseTranslatableStringV2 = (rawMessage: string): TranslatableMessageV2 => {
  let context
  let content

  const from = rawMessage.includes(FROM_LEFT_DELIMITER) && rawMessage.includes(FROM_RIGHT_DELIMITER)?
  rawMessage.substring(rawMessage.lastIndexOf(FROM_LEFT_DELIMITER)+FROM_LEFT_DELIMITER.length,
  rawMessage.lastIndexOf(FROM_RIGHT_DELIMITER))
  : ''

  const splitted = rawMessage.split(CONTEXT_LEFT_DELIMITER)
  if (splitted.length === 2) {
    content = splitted[0]
    context = splitted[1].substring(0,splitted[1].lastIndexOf(CONTEXT_RIGHT_DELIMITER))
  }
  else{
    content = rawMessage.substring(0,rawMessage.lastIndexOf(FROM_LEFT_DELIMITER))
  }

  return {
    content,
    context,
    from,
  }
}

export const formatTranslatableStringV2 = ({from, content, context}: TranslatableMessageV2): string => {
  if (context){
    return `${content}${CONTEXT_LEFT_DELIMITER}${context}${CONTEXT_RIGHT_DELIMITER}${FROM_LEFT_DELIMITER}${from}${FROM_RIGHT_DELIMITER}`
  }
  return `${content}${FROM_LEFT_DELIMITER}${from}${FROM_RIGHT_DELIMITER}`
}

const handleSingleString = (ctx: ServiceContext<IOClients, void, void>, behavior: Behavior) => async (rawMessage: string | null) => {
  // Messages only knows how to process non empty strings.
  if (rawMessage == null) {
    return rawMessage
  }

  const { content, context, from } = parseTranslatableStringV2(rawMessage)
  const { clients: { segment }, vtex: { locale } } = ctx

  if (content == null) {
    throw new Error(`@translatable directive needs a content to translate, but received ${JSON.stringify(rawMessage)}`)
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
    content,
    context,
    from,
    to,
  })
}

