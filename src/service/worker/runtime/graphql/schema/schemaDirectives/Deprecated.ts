export const deprecatedDirectiveTypeDefs = `
directive @deprecated(
  reason: String = "No longer supported"
) on
    FIELD_DEFINITION
  | INPUT_FIELD_DEFINITION
  | ARGUMENT_DEFINITION
  | FRAGMENT_DEFINITION
`
