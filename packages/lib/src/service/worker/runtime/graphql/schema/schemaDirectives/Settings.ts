import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { Apps } from '../../../../../../clients/infra/Apps'
import { getDependenciesSettings } from '../../../http/middlewares/settings'
import { RouteSettingsType } from '../../../typings'

const addSettings = async (settings: RouteSettingsType, ctx: any) => {
  if (settings === 'pure') { return ctx }

  const { clients: { apps, assets } } = ctx
  const dependenciesSettings = await getDependenciesSettings(apps as Apps, assets)
  if (!ctx.vtex) {
    ctx.vtex = {}
  }
  ctx.vtex.settings = { ...ctx.vtex.settings, dependenciesSettings }
}

export class SettingsDirective extends SchemaDirectiveVisitor {
  public visitFieldDefinition (field: GraphQLField<any, any>) {
    const {resolve = defaultFieldResolver} = field
    const { settingsType } = this.args
    field.resolve = async (root, args, ctx, info) => {
      if (settingsType) {
        await addSettings(settingsType, ctx)
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
