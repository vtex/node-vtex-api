/**
 * Lenient variable coercion that mimics the behavior of graphql-js < 14.5.
 *
 * graphql-js 14.5+ made the built-in `Int`, `Float`, and `String` scalars strict:
 * `Int.parseValue` rejects strings, `Float.parseValue` rejects strings, and
 * `String.parseValue` rejects numbers. Before 14.5 these scalars used `Number(value)`
 * and `String(value)` and accepted these conversions silently.
 *
 * Many existing apps (and their clients) rely on the lenient behavior — for example,
 * sending `{ "id": "20" }` for a `$id: Int` variable, or `{ "quantity": 1 }` for an
 * input field declared as `String`. After upgrading from `@vtex/api@^3.x` (which
 * bundled `graphql@^0.13.2`) to `@vtex/api@^7.x` (which bundles `graphql@^14.5.8`)
 * these requests fail with `"Int cannot represent non-integer value: \"20\""` and
 * similar errors during `coerceVariableValues`.
 *
 * This module pre-coerces the incoming `variableValues` object to the types declared
 * in the operation's `VariableDefinition`s, replicating the lenient conversions that
 * the old runtime did. It only touches values that are unambiguously convertible:
 *
 *   - `Int`     ← string of a finite integer, boolean
 *   - `Float`   ← string of a finite number, boolean
 *   - `String`  ← number, boolean
 *   - `ID`      ← number (graphql 14.5 ID is already lenient for strings)
 *   - `Boolean` ← left alone (no historical lenient conversion)
 *
 * Anything that doesn't match one of those patterns is left unchanged so that the
 * standard `coerceVariableValues` of graphql-js still produces its native error.
 *
 * The traversal walks `NonNull`, `List`, and `InputObject` types so nested fields
 * (e.g. `[ShippingItem!]!.quantity: String`) are coerced too.
 *
 * Custom scalars are NOT touched — their `parseValue` is whatever the app declared.
 *
 * Disable with the environment variable `VTEX_API_DISABLE_LENIENT_VARIABLE_COERCION=true`
 * to fall back to strict graphql-js behavior.
 */

import {
  DocumentNode,
  GraphQLFloat,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  isInputObjectType,
  isListType,
  isNonNullType,
  isScalarType,
  OperationDefinitionNode,
  typeFromAST,
} from 'graphql'

const MAX_INT = 2147483647
const MIN_INT = -2147483648

const isPlainObject = (value: any): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * Coerce a single leaf value against a built-in scalar, replicating the lenient
 * conversions of graphql-js 0.13. Returns the coerced value, or the original
 * value when no safe conversion applies.
 */
const coerceLeafLenient = (value: any, scalar: GraphQLScalarType): any => {
  if (value === null || value === undefined) {
    return value
  }

  if (scalar === GraphQLInt) {
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0
    }
    if (typeof value === 'string' && value !== '') {
      const num = Number(value)
      if (Number.isInteger(num) && num <= MAX_INT && num >= MIN_INT) {
        return num
      }
    }
    return value
  }

  if (scalar === GraphQLFloat) {
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0
    }
    if (typeof value === 'string' && value !== '') {
      const num = Number(value)
      if (Number.isFinite(num)) {
        return num
      }
    }
    return value
  }

  if (scalar === GraphQLString) {
    if (typeof value === 'string') {
      return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    return value
  }

  if (scalar === GraphQLID) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
    return value
  }

  return value
}

/**
 * Recursively coerce a value against a GraphQL input type. Walks NonNull/List
 * wrappers and InputObject fields. Enum and custom scalar leaves are returned
 * unchanged.
 */
const coerceValueAgainstType = (value: any, type: GraphQLInputType): any => {
  if (value === null || value === undefined) {
    return value
  }

  if (isNonNullType(type)) {
    return coerceValueAgainstType(value, type.ofType as GraphQLInputType)
  }

  if (isListType(type)) {
    const itemType = type.ofType as GraphQLInputType
    if (Array.isArray(value)) {
      return value.map(item => coerceValueAgainstType(item, itemType))
    }
    // graphql-js coerces a single value to a one-element list; we mirror that
    // by coercing the lone value but leave the wrapping shape to graphql-js.
    return coerceValueAgainstType(value, itemType)
  }

  if (isInputObjectType(type)) {
    if (!isPlainObject(value)) {
      return value
    }
    const fields = (type as GraphQLInputObjectType).getFields()
    const out: Record<string, any> = {}
    for (const key of Object.keys(value)) {
      const fieldDef = fields[key]
      if (fieldDef) {
        out[key] = coerceValueAgainstType(value[key], fieldDef.type as GraphQLInputType)
      } else {
        // Unknown field: keep as-is so graphql-js produces its own error.
        out[key] = value[key]
      }
    }
    return out
  }

  if (isScalarType(type)) {
    return coerceLeafLenient(value, type)
  }

  // Enum or anything else: leave alone, graphql-js will validate.
  return value
}

const findOperation = (
  document: DocumentNode,
  operationName?: string
): OperationDefinitionNode | undefined => {
  let firstOperation: OperationDefinitionNode | undefined
  for (const def of document.definitions) {
    if (def.kind !== 'OperationDefinition') {
      continue
    }
    if (operationName) {
      if (def.name && def.name.value === operationName) {
        return def
      }
    } else {
      if (firstOperation) {
        // Multiple operations and no operationName — graphql-js will reject;
        // skip lenient coercion in this ambiguous case.
        return undefined
      }
      firstOperation = def
    }
  }
  return firstOperation
}

const isDisabledByEnv = (): boolean =>
  process.env.VTEX_API_DISABLE_LENIENT_VARIABLE_COERCION === 'true'

/**
 * Pre-process variable values for an incoming GraphQL operation, applying the
 * pre-14.5 lenient scalar coercion rules. Returns a new object so the caller's
 * input is not mutated.
 *
 * On any unexpected error (malformed document, type resolution failure, etc.)
 * returns the original `variableValues` unchanged so graphql-js can produce its
 * own error.
 */
export const coerceVariableValuesLenient = (
  schema: GraphQLSchema,
  document: DocumentNode,
  variableValues: Record<string, any> | undefined,
  operationName?: string
): Record<string, any> | undefined => {
  if (!variableValues || isDisabledByEnv()) {
    return variableValues
  }

  try {
    const operation = findOperation(document, operationName)
    if (!operation || !operation.variableDefinitions || operation.variableDefinitions.length === 0) {
      return variableValues
    }

    const coerced: Record<string, any> = { ...variableValues }
    for (const varDef of operation.variableDefinitions) {
      const name = varDef.variable.name.value
      if (!(name in coerced)) {
        continue
      }
      const type = typeFromAST(schema, varDef.type as any) as GraphQLInputType | undefined
      if (!type) {
        continue
      }
      coerced[name] = coerceValueAgainstType(coerced[name], type)
    }
    return coerced
  } catch {
    return variableValues
  }
}

// Re-exported for tests so we don't have to roundtrip through a document/schema
// to exercise the leaf logic.
export const testing = {
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  coerceLeafLenient,
  coerceValueAgainstType,
}
