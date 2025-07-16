import { defaultFieldResolver, GraphQLField } from "graphql";
import { SchemaDirectiveVisitor } from "graphql-tools"

export class Public extends SchemaDirectiveVisitor {
  visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field;

    field.resolve = async function (...args) {
      return resolve.apply(this, args);
    };
  }
}

export const publicDirectiveTypeDefs = `directive @public on FIELD_DEFINITION`
