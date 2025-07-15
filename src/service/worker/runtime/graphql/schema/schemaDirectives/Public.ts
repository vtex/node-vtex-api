import { SchemaDirectiveVisitor } from "graphql-tools"

export class Public extends SchemaDirectiveVisitor {
}

export const publicDirectiveTypeDefs = `
directive @public(
) on FIELD_DEFINITION
`
