import { ApolloError } from 'apollo-server-core'
import DataLoader from 'dataloader'
import { ASTNode, GraphQLScalarType, Kind } from 'graphql'

export interface IOMessage {
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
  const args = typeof(inputArgs) === 'string' ? {content: inputArgs, description: ''} : inputArgs
  const {content, from} = args
  const {translationsLoader, getLocaleTo} = ctx
  const to = await getLocaleTo()

  // If the message has no content, or no target locale,
  // or if it's already in the target locale, return the content.
  if (!content || !to || from === to) {
    return content
  }

  const obj =  {
    ...args,
    from,
    to,
  }

  return await translationsLoader.load(obj)
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
