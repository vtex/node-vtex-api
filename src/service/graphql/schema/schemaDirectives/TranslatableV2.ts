import { map } from 'bluebird'
import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { path } from 'ramda'

import { Behavior } from '../../../../clients'
import { IOContext, ServiceContext } from '../../../typings'
import { MessagesLoaderV2, messagesLoaderV2 } from '../messagesLoaderV2'

const CONTEXT_REGEX = /\(\(\((?<context>(.)*)\)\)\)/
const FROM_REGEX = /\<\<\<(?<from>(.)*)\>\>\>/
const CONTENT_REGEX = /\(\(\((?<context>(.)*)\)\)\)|\<\<\<(?<from>(.)*)\>\>\>/g

export class TranslatableV2 extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { behavior = 'FULL', withAppsMetaInfo = false} = this.args
    field.resolve = async (root, args, ctx, info) => {
      if (!ctx.loaders || !ctx.loaders.messagesV2) {
        ctx.loaders = {
          ...ctx.loaders,
          messagesV2: messagesLoaderV2(ctx.clients),
        }
      }
      const response = await resolve(root, args, ctx, info) as string | string[] | null
      const { vtex, loaders: { messagesV2 } } = ctx
      const handler = handleSingleString(vtex, messagesV2!, behavior, withAppsMetaInfo)
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

const handleSingleString = (ctx: IOContext, messagesV2: MessagesLoaderV2, behavior: Behavior, withAppsMetaInfo: boolean) => async (rawMessage: string | null) => {
  // Messages only knows how to process non empty strings.
  if (rawMessage == null) {
    return rawMessage
  }

  const { content, context, from: maybeFrom } = parseTranslatableStringV2(rawMessage)
  const { locale: to, tenant } = ctx

  if (content == null) {
    throw new Error(`@translatableV2 directive needs a content to translate, but received ${JSON.stringify(rawMessage)}`)
  }

  if (to == null) {
    throw new Error('@translatableV2 directive needs the locale variable available in IOContext. You can do this by either setting \`ctx.vtex.locale\` directly or calling this app with \`x-vtex-locale\` header')
  }

  const from = maybeFrom || (tenant && tenant.locale)

  if (from == null) {
    throw new Error('@translatableV2 directive needs a source language to translate from. You can do this by either setting \`ctx.vtex.tenant\` variable, call this app with the header \`x-vtex-tenant\` or format the string with the \`formatTranslatableStringV2\` function with the \`from\` option set')
  }

  // If the message is already in the target locale, return the content.
  if (!to || from === to) {
    return content
  }

  return messagesV2.load({
    behavior,
    content,
    context,
    from,
    to,
    withAppsMetaInfo,
  })
}

