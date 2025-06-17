import { IOClients } from '../../../../../clients'
import { HeaderKeys } from '../../../../../constants'
import { majorEqualAndGreaterThan, parseAppId } from '../../../../../utils'
import { GraphQLOptions, ParamsContext, RecorderState } from '../../typings'
import { makeSchema } from '../schema/index'
import { ExecutableSchema } from '../typings'
import { GraphQLServiceContext } from '../typings'

export const updateSchema = <T extends IOClients, U extends RecorderState, V extends ParamsContext>(
  graphql: GraphQLOptions<T, U, V>,
  executableSchema: ExecutableSchema
) =>
  async function updateRunnableSchema(ctx: GraphQLServiceContext, next: () => Promise<void>) {
    const {
      clients: { apps },
      vtex: { logger },
      app,
    } = ctx

    if (!ctx.headers[HeaderKeys.PROVIDER]) {
      await next()
      return
    }

    // fetches the new schema and generate a new runnable schema, updates the provider app,
    if (
      executableSchema.hasProvider &&
      (!executableSchema.provider ||
        majorEqualAndGreaterThan(
          parseAppId(ctx.headers[HeaderKeys.PROVIDER]).version,
          parseAppId(executableSchema.provider).version
        ))
    ) {
      try {
        const newSchema = (await apps.getAppFile(ctx.headers[HeaderKeys.PROVIDER], 'public/schema.graphql')).data.toString(
          'utf-8'
        )
        graphql.schema = newSchema
        const newRunnableSchema = makeSchema(graphql)
        executableSchema.schema = newRunnableSchema.schema
        executableSchema.provider = ctx.headers[HeaderKeys.PROVIDER]
      } catch (error) {
        logger.error({ error, message: 'Update schema failed', app })
      }
    }
    await next()
  }
