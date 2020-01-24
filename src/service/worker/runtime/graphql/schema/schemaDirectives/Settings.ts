import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { join } from 'path'
import { Apps } from '../../../../../../clients/infra/Apps'
import { RouteSettingsType } from '../../../typings'

const addSettings = async (settings: RouteSettingsType, ctx: any) => {
  if (settings === 'pure') { return ctx }

  let dependenciesSettings = {}
  try {
    const middlewarePath = join(process.cwd(), './service/node_modules/@vtex/settings-middleware')
    const lib = await import(middlewarePath)
    dependenciesSettings = await lib.getDependenciesSettings(ctx)
  } catch (e) {
    console.log('ERROR IMPORTING getDependenciesSettings from @vtex/settings-middleware', e)
  }
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
