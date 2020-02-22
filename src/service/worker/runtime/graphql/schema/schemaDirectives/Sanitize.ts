import { GraphQLArgument, GraphQLField, GraphQLInputField, GraphQLNonNull, GraphQLScalarType } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { IOSanitizedStringType, SanitizeOptions } from '../typeDefs/sanitizedString'

export class SanitizeDirective extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    this.wrapType(field)
  }

  public visitInputFieldDefinition(field: GraphQLInputField) {
    this.wrapType(field)
  }

  public visitArgumentDefinition(argument: GraphQLArgument) {
    this.wrapType(argument)
  }

  public wrapType(field: any) {
    const options = this.args as SanitizeOptions
    if (field.type instanceof GraphQLNonNull && field.type.ofType instanceof GraphQLScalarType) {
      field.type = new GraphQLNonNull(new IOSanitizedStringType(options))
    } else if (field.type instanceof GraphQLScalarType) {
      field.type = new IOSanitizedStringType(options)
    } else {
      throw new Error('Can not apply @sanitize directive to non-scalar GraphQL type')
    }
  }
}

export const sanitizeDirectiveTypeDefs = `
directive @sanitize(
  allowHTMLTags: Boolean
  stripIgnoreTag: Boolean
) on FIELD_DEFINITION | INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION
`
