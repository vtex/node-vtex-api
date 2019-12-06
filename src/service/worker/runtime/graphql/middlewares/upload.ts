import { graphqlUploadKoa } from 'graphql-upload'

import { GraphQLServiceContext } from '../typings'

const graphqlUpload = graphqlUploadKoa({
  maxFieldSize: 1e6, // size in Bytes
  maxFileSize: 4 * 1e6, // size in Bytes
  maxFiles: 10,
})

function graphqlUploadKoaMiddleware(
  ctx: GraphQLServiceContext,
  next: () => Promise<any>
): Promise<void> {
  return graphqlUpload(ctx as any, next)
}

export const upload = graphqlUploadKoaMiddleware
