import { map } from 'bluebird'
import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { path, prop } from 'ramda'

import { Behavior, Segment } from '../../../../clients'
import { IOClients } from '../../../../clients/IOClients'
import { ServiceContext } from '../../../typings'
import { messagesLoaderV2 } from '../messagesLoaderV2'

const CONTEXT_REGEX = /\(\(\((?<context>(.)*)\)\)\)/
const FROM_REGEX = /\<\<\<(?<from>(.)*)\>\>\>/
const CONTENT_REGEX = /\(\(\((?<context>(.)*)\)\)\)|\<\<\<(?<from>(.)*)\>\>\>/g

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
  from?: string
  content: string
  context?: string
}

export const parseTranslatableStringV2 = (rawMessage: string): TranslatableMessageV2 => {
  const context = path<string>(['groups', 'context'], rawMessage.match(CONTEXT_REGEX) || {})
  const from = path<string>(['groups', 'from'], rawMessage.match(FROM_REGEX) || {})
  const content = rawMessage.replace(CONTENT_REGEX, '')

  return {
    content: content && content.trim(),
    context: context && context.trim(),
    from: from && from.trim(),
  }
}

export const formatTranslatableStringV2 = ({from, content, context}: TranslatableMessageV2): string =>
  `${content} ${context ? `(((${context})))` : ''} ${from ? `<<<${from}>>>` : ''}`

export const localeFromTenant = (segment: Segment) =>
  segment.getSegmentByToken(null).then(prop('cultureInfo'))

export const localeFromSegment = (segment: Segment) =>
  segment.getSegment().then(prop('cultureInfo'))

const handleSingleString = (ctx: ServiceContext<IOClients, void, void>, behavior: Behavior) => async (rawMessage: string | null) => {
  // Messages only knows how to process non empty strings.
  if (rawMessage == null) {
    return rawMessage
  }

  const { content, context, from: maybeFrom } = parseTranslatableStringV2(rawMessage)
  const { clients: { segment }, vtex: { locale } } = ctx

  if (content == null) {
    throw new Error(`@translatable directive needs a content to translate, but received ${JSON.stringify(rawMessage)}`)
  }

  const toPromise = locale || localeFromSegment(segment)
  const fromPromise = maybeFrom || localeFromTenant(segment)
  const [to, from] = await Promise.all([toPromise, fromPromise])

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

