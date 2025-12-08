import { OperationDefinitionNode } from 'graphql'
import { GraphQLTags } from '../../../../../tracing/Tags'
import { GraphQLServiceContext } from '../typings'

/**
 * Middleware that adds GraphQL operation info to the current span.
 * Must run AFTER extractQuery middleware which parses the query.
 *
 * Note: ctx.tracing is set to undefined by traceUserLandRemainingPipelineMiddleware,
 * so we use ctx.vtex.tracer to access the span instead.
 */
export const graphqlSpanTags = () =>
  async function addGraphQLSpanTags(ctx: GraphQLServiceContext, next: () => Promise<void>) {
    const { graphql, vtex } = ctx
    const query = graphql?.query
    const tracer = vtex?.tracer

    // Get operation name - either from explicit operationName field or from the parsed document
    let operationName = query?.operationName
    let operationType: string | undefined

    if (query?.document) {
      const operationDefinition = query.document.definitions.find(
        (def): def is OperationDefinitionNode => def.kind === 'OperationDefinition'
      )

      if (operationDefinition) {
        operationType = operationDefinition.operation
        // If operationName wasn't explicitly provided, get it from the document
        if (!operationName && operationDefinition.name?.value) {
          operationName = operationDefinition.name.value
        }
      }
    }

    // Add tags to the span via tracer (ctx.tracing is undefined at this point)
    if (tracer?.isTraceSampled) {
      if (operationName) {
        tracer.setFallbackSpanTag(GraphQLTags.GRAPHQL_OPERATION_NAME, operationName)
      }
      if (operationType) {
        tracer.setFallbackSpanTag(GraphQLTags.GRAPHQL_OPERATION_TYPE, operationType)
      }

      // Update span operation name to include the GraphQL operation
      if (operationName) {
        const currentOpName = ctx.requestHandlerName || 'graphql-handler:__graphql'
        const newOpName = `${currentOpName}:${operationName}`
        tracer.setFallbackSpanOperationName(newOpName)
        ctx.requestHandlerName = newOpName
      }
    }

    await next()
  }

