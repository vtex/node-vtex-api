import { graphqlUploadKoa } from 'graphql-upload'
import { call } from 'ramda'
import { GraphQLServiceContext } from '../typings'

declare module 'graphql-upload' {
  export function graphqlUploadKoa(options: ApolloUploadOptions): (ctx: GraphQLServiceContext, next: () => Promise<any>) => Promise<void>
}

function graphqlUploadKoaMiddleware(ctx: GraphQLServiceContext, next: () => Promise<any>): Promise<void> {
  return call(
    graphqlUploadKoa({
      maxFieldSize: 1e6, // size in Bytes
      maxFileSize: 4 * 1e6, // size in Bytes
      maxFiles: 5,
    }),
    ctx,
    next
  )
}

export const upload = graphqlUploadKoaMiddleware
