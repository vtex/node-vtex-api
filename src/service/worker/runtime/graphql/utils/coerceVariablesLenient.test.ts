import { buildSchema, execute, parse } from 'graphql'

import { coerceVariableValuesLenient } from './coerceVariablesLenient'

const SHIPPING_SCHEMA = buildSchema(`
  scalar IOUpload

  input ShippingItem {
    id: String
    quantity: String
    seller: String
  }

  type LogisticsInfo {
    itemIndex: Int
  }

  type Shipping {
    logisticsInfo: [LogisticsInfo]
  }

  type Category {
    id: Int
    name: String
  }

  type Document {
    id: String
  }

  enum SortOrder {
    ASC
    DESC
  }

  input CustomDoc {
    fields: [DocField]
  }

  input DocField {
    key: String
    value: String
  }

  type Query {
    category(id: Int): Category
    categories(treeLevel: Int): [Category]
    shipping(
      items: [ShippingItem]
      postalCode: String
      country: String
      geoCoordinates: [String]
    ): Shipping
    documents(acronym: String, page: Int, pageSize: Int): [Document]
    enumQuery(order: SortOrder): String
    listOfNonNullInts(values: [Int!]!): String
    nestedInput(doc: CustomDoc): String
  }
`)

const variablesFor = (query: string, vars: Record<string, any>, operationName?: string) =>
  coerceVariableValuesLenient(SHIPPING_SCHEMA, parse(query), vars, operationName)

describe('coerceVariableValuesLenient', () => {
  afterEach(() => {
    delete process.env.VTEX_API_DISABLE_LENIENT_VARIABLE_COERCION
  })

  describe('production error patterns', () => {
    it('coerces $id: Int with string value (category pattern)', () => {
      const result = variablesFor(
        `query CategoryChildren($categoryId: Int) { category(id: $categoryId) { id name } }`,
        { categoryId: '20' },
        'CategoryChildren'
      )
      expect(result).toEqual({ categoryId: 20 })
    })

    it('coerces $treeLevel: Int with string value', () => {
      const result = variablesFor(
        `query categories($treeLevel: Int) { categories(treeLevel: $treeLevel) { id } }`,
        { treeLevel: '3' }
      )
      expect(result).toEqual({ treeLevel: 3 })
    })

    it('coerces ShippingItem.quantity (String) when sent as Int', () => {
      const result = variablesFor(
        `query getShippingEstimates($items: [ShippingItem], $country: String) {
          shipping(items: $items, country: $country) { logisticsInfo { itemIndex } }
        }`,
        { country: 'BRA', items: [{ id: '19361', quantity: 1, seller: '1' }] }
      )
      expect(result).toEqual({
        country: 'BRA',
        items: [{ id: '19361', quantity: '1', seller: '1' }],
      })
    })

    it('coerces ShippingItem.seller (String) when sent as Int', () => {
      const result = variablesFor(
        `query($items: [ShippingItem]) { shipping(items: $items) { logisticsInfo { itemIndex } } }`,
        { items: [{ id: '1', quantity: '1', seller: 1 }] }
      )
      expect(result).toEqual({ items: [{ id: '1', quantity: '1', seller: '1' }] })
    })

    it('coerces ShippingItem when sent as a single object instead of a list', () => {
      const result = variablesFor(
        `query getShippingInfo($shippingItems: [ShippingItem]) {
          shipping(items: $shippingItems) { logisticsInfo { itemIndex } }
        }`,
        { shippingItems: { id: '300', seller: '1', quantity: 1 } }
      )
      expect(result).toEqual({ shippingItems: { id: '300', seller: '1', quantity: '1' } })
    })

    it('coerces geoCoordinates: [String] sent as [Float]', () => {
      const result = variablesFor(
        `query($items: [ShippingItem], $geo: [String], $country: String) {
          shipping(items: $items, geoCoordinates: $geo, country: $country) { logisticsInfo { itemIndex } }
        }`,
        { items: [{ id: '1', quantity: '1', seller: '1' }], geo: [12.4964, 41.8919], country: 'ITA' }
      )
      expect(result).toEqual({
        items: [{ id: '1', quantity: '1', seller: '1' }],
        geo: ['12.4964', '41.8919'],
        country: 'ITA',
      })
    })

    it('coerces postalCode: String when sent as Int', () => {
      const result = variablesFor(
        `query($items: [ShippingItem], $postalCode: String, $country: String) {
          shipping(items: $items, postalCode: $postalCode, country: $country) { logisticsInfo { itemIndex } }
        }`,
        { items: [{ id: '1', quantity: '1', seller: '1' }], postalCode: 1000, country: 'ARG' }
      )
      expect(result).toEqual({
        items: [{ id: '1', quantity: '1', seller: '1' }],
        postalCode: '1000',
        country: 'ARG',
      })
    })

    it('coerces documents pageSize sent as String', () => {
      const result = variablesFor(
        `query($acronym: String, $page: Int, $pageSize: Int) {
          documents(acronym: $acronym, page: $page, pageSize: $pageSize) { id }
        }`,
        { acronym: 'NL', page: 1, pageSize: '2' }
      )
      expect(result).toEqual({ acronym: 'NL', page: 1, pageSize: 2 })
    })
  })

  describe('values already correctly typed (no-op)', () => {
    it('leaves Int as Int', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: 20 })
      expect(result).toEqual({ id: 20 })
    })

    it('leaves String as String', () => {
      const result = variablesFor(
        `query($postalCode: String) { shipping(postalCode: $postalCode) { logisticsInfo { itemIndex } } }`,
        { postalCode: '00000' }
      )
      expect(result).toEqual({ postalCode: '00000' })
    })

    it('leaves null/undefined alone', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, {
        id: null,
      })
      expect(result).toEqual({ id: null })
    })

    it('does not touch enum values', () => {
      const result = variablesFor(`query($order: SortOrder) { enumQuery(order: $order) }`, {
        order: 'ASC',
      })
      expect(result).toEqual({ order: 'ASC' })
    })

    it('does not coerce custom scalars', () => {
      const result = variablesFor(`query($file: IOUpload) { enumQuery(order: ASC) }`, {
        file: { name: 'whatever' },
      })
      expect(result).toEqual({ file: { name: 'whatever' } })
    })

    it('returns the same object shape (does not mutate input)', () => {
      const input = { categoryId: '20' }
      const result = variablesFor(
        `query CategoryChildren($categoryId: Int) { category(id: $categoryId) { id } }`,
        input,
        'CategoryChildren'
      )
      expect(input).toEqual({ categoryId: '20' }) // original unchanged
      expect(result).toEqual({ categoryId: 20 })
    })
  })

  describe('values that should still raise the standard graphql-js error', () => {
    it('does not coerce non-numeric strings to Int', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: 'abc' })
      expect(result).toEqual({ id: 'abc' })
    })

    it('does not coerce empty string to Int', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: '' })
      expect(result).toEqual({ id: '' })
    })

    it('does not coerce float string to Int (would lose precision)', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: '20.5' })
      expect(result).toEqual({ id: '20.5' })
    })

    it('does not coerce arrays to scalar', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: [1, 2] })
      expect(result).toEqual({ id: [1, 2] })
    })

    it('does not coerce objects to String', () => {
      const result = variablesFor(
        `query($postalCode: String) { shipping(postalCode: $postalCode) { logisticsInfo { itemIndex } } }`,
        { postalCode: { foo: 'bar' } }
      )
      expect(result).toEqual({ postalCode: { foo: 'bar' } })
    })

    it('does not coerce out-of-range ints', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, {
        id: '99999999999999999',
      })
      expect(result).toEqual({ id: '99999999999999999' })
    })
  })

  describe('type wrappers', () => {
    it('coerces inside [Int!]!', () => {
      const result = variablesFor(`query($v: [Int!]!) { listOfNonNullInts(values: $v) }`, {
        v: ['1', '2', '3'],
      })
      expect(result).toEqual({ v: [1, 2, 3] })
    })

    it('coerces inside nested input objects (CustomDoc.fields[].value)', () => {
      const result = variablesFor(
        `query($doc: CustomDoc) { nestedInput(doc: $doc) }`,
        { doc: { fields: [{ key: 'name', value: 42 }, { key: 'age', value: '13' }] } }
      )
      expect(result).toEqual({
        doc: { fields: [{ key: 'name', value: '42' }, { key: 'age', value: '13' }] },
      })
    })

    it('preserves unknown fields in input objects', () => {
      const result = variablesFor(
        `query($items: [ShippingItem]) { shipping(items: $items) { logisticsInfo { itemIndex } } }`,
        { items: [{ id: '1', quantity: 1, extra: 'preserved' }] as any }
      )
      expect(result).toEqual({ items: [{ id: '1', quantity: '1', extra: 'preserved' }] })
    })
  })

  describe('boolean and edge conversions (graphql 0.13 parity)', () => {
    it('coerces true -> 1 for Int (matches Number(true))', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: true })
      expect(result).toEqual({ id: 1 })
    })

    it('coerces number -> string for String', () => {
      const result = variablesFor(
        `query($postalCode: String) { shipping(postalCode: $postalCode) { logisticsInfo { itemIndex } } }`,
        { postalCode: 1000 }
      )
      expect(result).toEqual({ postalCode: '1000' })
    })

    it('coerces boolean -> string for String', () => {
      const result = variablesFor(
        `query($postalCode: String) { shipping(postalCode: $postalCode) { logisticsInfo { itemIndex } } }`,
        { postalCode: false }
      )
      expect(result).toEqual({ postalCode: 'false' })
    })
  })

  describe('operation selection', () => {
    it('uses operationName to disambiguate multiple operations', () => {
      const doc = `
        query A($id: Int) { category(id: $id) { id } }
        query B($name: String) { shipping(postalCode: $name) { logisticsInfo { itemIndex } } }
      `
      const result = variablesFor(doc, { id: '5', name: 9 }, 'B')
      // Coerces only $name (used by B); $id is unrelated to B's variable defs
      expect(result).toEqual({ id: '5', name: '9' })
    })

    it('skips coercion when multiple operations and no operationName', () => {
      const doc = `
        query A($id: Int) { category(id: $id) { id } }
        query B($id: String) { shipping(postalCode: $id) { logisticsInfo { itemIndex } } }
      `
      const result = variablesFor(doc, { id: '5' })
      expect(result).toEqual({ id: '5' })
    })

    it('uses the only operation when no operationName given', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: '5' })
      expect(result).toEqual({ id: 5 })
    })
  })

  describe('feature flag', () => {
    it('does nothing when VTEX_API_DISABLE_LENIENT_VARIABLE_COERCION=true', () => {
      process.env.VTEX_API_DISABLE_LENIENT_VARIABLE_COERCION = 'true'
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: '20' })
      expect(result).toEqual({ id: '20' })
    })

    it('runs normally when env var is unset', () => {
      delete process.env.VTEX_API_DISABLE_LENIENT_VARIABLE_COERCION
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: '20' })
      expect(result).toEqual({ id: 20 })
    })

    it('runs normally when env var has any other value', () => {
      process.env.VTEX_API_DISABLE_LENIENT_VARIABLE_COERCION = 'false'
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, { id: '20' })
      expect(result).toEqual({ id: 20 })
    })
  })

  describe('safety', () => {
    it('returns input unchanged when there are no variables', () => {
      const doc = parse(`{ category(id: 1) { id } }`)
      expect(coerceVariableValuesLenient(SHIPPING_SCHEMA, doc, undefined)).toBeUndefined()
      expect(coerceVariableValuesLenient(SHIPPING_SCHEMA, doc, {})).toEqual({})
    })

    it('returns input unchanged for variables not declared in the operation', () => {
      const result = variablesFor(`query($id: Int) { category(id: $id) { id } }`, {
        id: '20',
        unknown: 'kept',
      })
      expect(result).toEqual({ id: 20, unknown: 'kept' })
    })

    it('falls back to original variables on internal failure', () => {
      // Empty/invalid document — findOperation returns undefined, no coercion
      const fakeDoc = { kind: 'Document', definitions: [] } as any
      const result = coerceVariableValuesLenient(SHIPPING_SCHEMA, fakeDoc, { x: '1' })
      expect(result).toEqual({ x: '1' })
    })
  })

  describe('end-to-end with execute()', () => {
    it('lets a query that previously failed now succeed', async () => {
      const schema = buildSchema(`
        type Query {
          category(id: Int): String
        }
      `)
      // Manual root resolver
      const rootValue = { category: ({ id }: { id: number }) => `cat-${id}` }
      const document = parse(`query CategoryChildren($categoryId: Int) {
        category(id: $categoryId)
      }`)
      const variables = coerceVariableValuesLenient(
        schema,
        document,
        { categoryId: '20' },
        'CategoryChildren'
      )
      const response = await execute({
        schema,
        document,
        rootValue,
        operationName: 'CategoryChildren',
        variableValues: variables,
      })
      expect(response.errors).toBeUndefined()
      expect(response.data).toEqual({ category: 'cat-20' })
    })

    it('without coercion, the same query produces the production error', async () => {
      const schema = buildSchema(`
        type Query {
          category(id: Int): String
        }
      `)
      const document = parse(`query CategoryChildren($categoryId: Int) {
        category(id: $categoryId)
      }`)
      const response = await execute({
        schema,
        document,
        rootValue: { category: () => 'should not run' },
        operationName: 'CategoryChildren',
        variableValues: { categoryId: '20' },
      })
      expect(response.errors).toBeDefined()
      expect(response.errors![0].message).toContain('Int cannot represent non-integer value')
    })
  })
})
