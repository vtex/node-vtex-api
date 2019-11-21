import { ForbiddenError, UserInputError } from 'apollo-server-errors'
import axios from 'axios'
import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { ServiceContext } from '../../../typings'

interface AuthDirectiveArgs {
  readonly productCode: string
  readonly resourceCode: string
}

async function getUserEmail (authToken: string, vtexIdToken: string): Promise<string | void> {
  const url = `vtexid.vtex.com.br/api/vtexid/pub/authenticated/user?authToken=${vtexIdToken}`
  const req = await axios.request({
    headers: {
      'Accept': 'application/json',
      'Proxy-Authorization': authToken,
      'X-VTEX-Proxy-To': `https://${url}`,
    },
    method: 'get',
    url: `http://${url}`,
  })
  if (!req.data) {
    return undefined
  }
  return req.data.user
}

async function getUserCanAccessResource (authToken: string, account: string, userEmail: string, productCode: string, resourceCode: string): Promise<boolean> {
  const url = `http://${account}.vtexcommercestable.com.br/api/license-manager/pvt/accounts/${account}/products/${productCode}/logins/${userEmail}/resources/${resourceCode}/granted`
  const req = await axios.request({
    headers: {
      'Authorization': authToken,
    },
    method: 'get',
    url,
  })
  return req.data
}

async function auth (ctx: ServiceContext, authArgs: AuthDirectiveArgs): Promise<void> {
  const vtexIdToken = ctx.cookies.get('VtexIdclientAutCookie') || ctx.get('VtexIdclientAutCookie')
  if (!vtexIdToken) {
    throw new ForbiddenError('VtexIdclientAutCookie not found.')
  }

  const userEmail = await getUserEmail(ctx.vtex.authToken, vtexIdToken)
  if (!userEmail) {
    throw new ForbiddenError('Could not find user specified by VtexIdclientAutCookie.')
  }

  const userCanAccessResource = await getUserCanAccessResource(ctx.vtex.authToken, ctx.vtex.account, userEmail, authArgs.productCode, authArgs.resourceCode)
  if (!userCanAccessResource) {
    throw new ForbiddenError('User indicated by VtexIdclientAutCookie is not authorized to access the indicated resource.')
  }
}

function parseArgs (authArgs: AuthDirectiveArgs): AuthDirectiveArgs {
  if (!authArgs.productCode || !authArgs.resourceCode) {
    throw new UserInputError('Invalid auth schema directive args. Usage: @auth(productCode: String, resourceCode: String).')
  }
  return authArgs
}

export class Auth extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, any>) {
    const {resolve = defaultFieldResolver} = field
    field.resolve = async (root, args, ctx, info) => {
      const authArgs = parseArgs(this.args as AuthDirectiveArgs)
      await auth(ctx, authArgs)
      return resolve(root, args, ctx, info)
    }
  }
}

export const authDirectiveTypeDefs = `
directive @auth(
  productCode: String
  resourceCode: String
) on FIELD_DEFINITION
`
