import { graphqlUploadKoa } from 'graphql-upload'
import { GraphQLServiceContext } from '../typings'

declare module 'graphql-upload' {
  export function graphqlUploadKoa(options: ApolloUploadOptions): (ctx: GraphQLServiceContext, next: () => Promise<any>) => Promise<void>
}

const graphqlUpload = graphqlUploadKoa({
  maxFieldSize: 1e6, // size in Bytes
  maxFileSize: 4 * 1e6, // size in Bytes
  maxFiles: 10,
})

function graphqlUploadKoaMiddleware(
  ctx: GraphQLServiceContext,
  next: () => Promise<any>
): Promise<void> {
  return graphqlUpload(ctx, next)
}

export const upload = graphqlUploadKoaMiddleware
