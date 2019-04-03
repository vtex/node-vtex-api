import { ApolloError } from 'apollo-server-core'
import DataLoader from 'dataloader'
import { ASTNode, GraphQLScalarType, Kind } from 'graphql'

export interface IOMessage {
  id: string
  content: string
  description: string
  from?: string
  to?: string
}

export interface NativeResolverContext {
  getLocaleTo: () => Promise<string>
  translationsLoader: DataLoader<IOMessage, string>
}

const serialize = (ctx: NativeResolverContext) => async (inputArgs: IOMessage | string) => {
  const args = typeof inputArgs === 'string' ? {content: inputArgs, description: '', from: undefined, id: inputArgs} : inputArgs
  const {content, from} = args
  const {translationsLoader, getLocaleTo} = ctx
  const to = await getLocaleTo()

  // If the message is already in the target locale, return the content.
  if (!to || from === to) {
    return content
  }

  return await translationsLoader.load({
    ...args,
    from,
    to,
  })
}

const parseValue = (_: string) => {
  throw new ApolloError(
    'You cannot use IOMessage as input value',
    'INVALID_INPUT_MESSAGE'
  )
}

export const resolvers = (ctx: NativeResolverContext) => new GraphQLScalarType({
  description: 'Internationalizeable String',
  name: 'IOMessage',
  parseLiteral(ast: ASTNode) {
    switch (ast.kind) {
      case Kind.STRING:
        return ast.value
      default:
        return null
    }
  },
  parseValue,
  serialize: serialize(ctx),
})
