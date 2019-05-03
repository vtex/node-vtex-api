import { graphqlUploadKoa } from 'graphql-upload'
import { GraphQLServiceContext } from '../typings'

declare module 'graphql-upload' {
  export function graphqlUploadKoa(
    options: ApolloUploadOptions
  ): (ctx: GraphQLServiceContext, next: () => Promise<any>) => Promise<void>
}

export const upload = graphqlUploadKoa({
  maxFieldSize: 1e6, // size in Bytes
  maxFileSize: 4 * 1e6, // size in Bytes
  maxFiles: 5,
})
