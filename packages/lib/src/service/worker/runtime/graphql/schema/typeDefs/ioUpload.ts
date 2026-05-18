import { GraphQLScalarType } from 'graphql'

const name = 'IOUpload'

export const scalar = name

export const resolvers = new GraphQLScalarType({
  description: 'The `IOUpload` scalar type represents a file upload.',
  name,
  parseValue: (value: any) => value,
  parseLiteral() {
    throw new Error('‘IOUpload’ scalar literal unsupported.')
  },
  serialize() {
    throw new Error('‘IOUpload’ scalar serialization unsupported.')
  },
})
