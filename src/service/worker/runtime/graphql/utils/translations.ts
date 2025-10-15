import { Behavior } from '../../../../../clients'
import { IOContext } from '../../typings'
import { MessagesLoaderV2 } from '../schema/messagesLoaderV2'

export const CONTEXT_REGEX = /\(\(\((?<context>(.)*)\)\)\)/
export const FROM_REGEX = /\<\<\<(?<from>(.)*)\>\>\>/
export const STATE_REGEX = /\[\[\[(?<state>(.)*)\]\]\]/
export const CONTENT_REGEX = /\(\(\((?<context>(.)*)\)\)\)|\<\<\<(?<from>(.)*)\>\>\>|\[\[\[(?<state>(.)*)\]\]\]/g

export interface TranslatableMessageV2 {
  from?: string
  content: string
  context?: string
  state?: 'original' | 'translated'
}

export type TranslationDirectiveType = 'translatableV2' | 'translateTo'

export const parseTranslatableStringV2 = (rawMessage: string): TranslatableMessageV2 => {
  const context = rawMessage.match(CONTEXT_REGEX)?.groups?.context
  const from = rawMessage.match(FROM_REGEX)?.groups?.from
  const state = rawMessage.match(STATE_REGEX)?.groups?.state
  const content = rawMessage.replace(CONTENT_REGEX, '')

  return {
    content: content?.trim(),
    context: context?.trim(),
    from: from?.trim(),
    state: (state?.trim() === 'translated' ? 'translated' : 'original') as 'translated' | 'original',
  }
}

export const formatTranslatableStringV2 = ({ from, content, context, state }: TranslatableMessageV2): string =>
  `${content} ${context ? `(((${context})))` : ''} ${from ? `<<<${from}>>>` : ''} ${state ? `[[[${state}]]]` : ''}`

export const handleSingleString =
  (ctx: IOContext, loader: MessagesLoaderV2, behavior: Behavior, directiveName: TranslationDirectiveType) =>
  async (rawMessage: string | null) => {
    // Messages only know how to process non empty strings.
    if (rawMessage == null) {
      return rawMessage
    }

    const { content, context, from: maybeFrom, state } = parseTranslatableStringV2(rawMessage)
    const { binding, tenant } = ctx

    if (content == null) {
      throw new Error(
        `@${directiveName} directive needs a content to translate, but received ${JSON.stringify(rawMessage)}`
      )
    }

    const from = maybeFrom || binding?.locale || tenant?.locale

    if (from == null) {
      throw new Error(
        `@${directiveName} directive needs a source language to translate from. You can do this by either setting ${'`ctx.vtex.tenant`'} variable, call this app with the header ${'`x-vtex-tenant`'} or format the string with the ${'`formatTranslatableStringV2`'} function with the ${'`from`'} option set`
      )
    }

    if (state === 'translated') {
      return content
    }

    return loader.load({
      behavior,
      content,
      context,
      from,
    })
  }
