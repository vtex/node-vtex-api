import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { Behavior } from '../../../../../../clients'
import { IOContext, ServiceContext } from '../../../typings'
import { createMessagesLoader, MessagesLoaderV2 } from '../messagesLoaderV2'

const CONTEXT_REGEX = /\(\(\((?<context>(.)*)\)\)\)/
const FROM_REGEX = /\<\<\<(?<from>(.)*)\>\>\>/
const CONTENT_REGEX = /\(\(\((?<context>(.)*)\)\)\)|\<\<\<(?<from>(.)*)\>\>\>/g

interface Args {
  behavior: 'FULL' | 'USER_AND_APP' | 'USER_ONLY'
  withAppsMetaInfo: boolean
}

export class TranslatableV2 extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, ServiceContext>) {
    const { resolve = defaultFieldResolver } = field
    const { behavior = 'FULL', withAppsMetaInfo = false } = this.args as Args
    field.resolve = async (root, args, ctx, info) => {
      if (!ctx.loaders?.messagesV2) {
        const {
          vtex: { locale: to },
        } = ctx

        if (to == null) {
          throw new Error(
            '@translatableV2 directive needs the locale variable available in IOContext. You can do this by either setting `ctx.vtex.locale` directly or calling this app with `x-vtex-locale` header'
          )
        }

        const dependencies = withAppsMetaInfo ? await ctx.clients.apps.getAppsMetaInfos() : undefined
        ctx.loaders = {
          ...ctx.loaders,
          messagesV2: createMessagesLoader(ctx.clients, to, dependencies),
        }
      }
      const response = (await resolve(root, args, ctx, info)) as string | string[] | null
      const {
        vtex,
        loaders: { messagesV2 },
      } = ctx
      const handler = handleSingleString(vtex, messagesV2!, behavior)
      return Array.isArray(response) ? Promise.all(response.map(handler)) : handler(response)
    }
  }
}

export interface TranslatableMessageV2 {
  from?: string
  content: string
  context?: string
}

export const parseTranslatableStringV2 = (rawMessage: string): TranslatableMessageV2 => {
  const context = rawMessage.match(CONTEXT_REGEX)?.groups?.context
  const from = rawMessage.match(FROM_REGEX)?.groups?.from
  const content = rawMessage.replace(CONTENT_REGEX, '')

  return {
    content: content?.trim(),
    context: context?.trim(),
    from: from?.trim(),
  }
}

export const formatTranslatableStringV2 = ({ from, content, context }: TranslatableMessageV2): string =>
  `${content} ${context ? `(((${context})))` : ''} ${from ? `<<<${from}>>>` : ''}`

const handleSingleString = (ctx: IOContext, messagesV2: MessagesLoaderV2, behavior: Behavior) => async (
  rawMessage: string | null
) => {
  // Messages only knows how to process non empty strings.
  if (rawMessage == null) {
    return rawMessage
  }

  const { content, context, from: maybeFrom } = parseTranslatableStringV2(rawMessage)
  const { binding, tenant } = ctx

  if (content == null) {
    throw new Error(
      `@translatableV2 directive needs a content to translate, but received ${JSON.stringify(rawMessage)}`
    )
  }

  const from = maybeFrom || binding?.locale || tenant?.locale

  if (from == null) {
    throw new Error(
      '@translatableV2 directive needs a source language to translate from. You can do this by either setting `ctx.vtex.tenant` variable, call this app with the header `x-vtex-tenant` or format the string with the `formatTranslatableStringV2` function with the `from` option set'
    )
  }

  return messagesV2.load({
    behavior,
    content,
    context,
    from,
  })
}

export const translatableV2DirectiveTypeDefs = `
directive @translatableV2(
  behavior: String
  withAppsMetaInfo: Boolean
) on FIELD_DEFINITION
`
