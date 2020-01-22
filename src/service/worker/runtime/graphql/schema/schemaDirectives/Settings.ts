import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { Apps } from '../../../../../../clients/infra/Apps'
import { Assets } from '../../../../../../clients/infra/Assets'
import { getDependenciesSettings } from '../../../http/middlewares/settings'
import { RouteSettingsType } from '../../../typings'

const getSettings = async (settingsType: any, ctx: any) => {
  const settings = settingsType as RouteSettingsType
  if (settings !== 'workspace' && settings !== 'userAndWorkspace') { return ctx }

  const { clients: { apps, assets } } = ctx
  const dependenciesSettings = await getDependenciesSettings(apps as Apps, assets)
  ctx = {
    ...ctx,
    vtex: {
      settings: dependenciesSettings,
      ...ctx.vtex,
    },
  }
  return ctx
}

export class SettingsDirective extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, any>) {
    const {resolve = defaultFieldResolver} = field
    const { settingsType } = this.args
    field.resolve = async (root, args, ctx, info) => {
      if (settingsType) {
        ctx = await getSettings(settingsType, ctx)
      }
      return resolve(root, args, ctx, info)
    }
  }
}

export const settingsDirectiveTypeDefs = `
directive @settings(
  settingsType: String
) on FIELD_DEFINITION
`
