import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { RouteSettingsType } from './../../../typings'

const getSettings = (settingsType: any, ctx: any): any => {
  const settings = settingsType as RouteSettingsType
  // TODO: get settings
  return ctx
}

export class Auth extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, any>) {
    const {resolve = defaultFieldResolver} = field
    const { settingsType } = this.args
    field.resolve = async (root, args, ctx, info) => {
      if (settingsType) {
        ctx = getSettings(settingsType, ctx)
      }
      return resolve(root, args, ctx, info)
    }
  }
}

export const authDirectiveTypeDefs = `
directive @route(
  settingsType: String
) on FIELD_DEFINITION
`
// serviceRoute.settingsType
