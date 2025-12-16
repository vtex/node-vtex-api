import { extractGraphQLOperationInfoSync } from './graphqlOperation'

describe('extractGraphQLOperationInfoSync', () => {
  describe('queries', () => {
    it('should extract operation name from a named query', () => {
      const query = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            name
          }
        }
      `

      const result = extractGraphQLOperationInfoSync(query)

      expect(result.operationName).toBe('GetProduct')
      expect(result.operationType).toBe('query')
    })

    it('should extract operation name from a query with shorthand syntax', () => {
      const query = `
        query Translate($args: TranslateArgs!) {
          translate(args: $args)
        }
      `

      const result = extractGraphQLOperationInfoSync(query)

      expect(result.operationName).toBe('Translate')
      expect(result.operationType).toBe('query')
    })

    it('should return unknown-operation for anonymous queries', () => {
      const query = `
        {
          product(id: "123") {
            id
            name
          }
        }
      `

      const result = extractGraphQLOperationInfoSync(query)

      expect(result.operationName).toBe('unknown-operation')
      expect(result.operationType).toBe('query')
    })

    it('should handle query keyword without name', () => {
      const query = `
        query {
          products {
            id
          }
        }
      `

      const result = extractGraphQLOperationInfoSync(query)

      expect(result.operationName).toBe('unknown-operation')
      expect(result.operationType).toBe('query')
    })
  })

  describe('mutations', () => {
    it('should extract operation name from a named mutation', () => {
      const mutation = `
        mutation CreateOrder($input: OrderInput!) {
          createOrder(input: $input) {
            id
            status
          }
        }
      `

      const result = extractGraphQLOperationInfoSync(mutation)

      expect(result.operationName).toBe('CreateOrder')
      expect(result.operationType).toBe('mutation')
    })

    it('should extract operation name from SaveV2 mutation', () => {
      const mutation = `
        mutation SaveV2($args: SaveArgsV2!) {
          saveV2(args: $args)
        }
      `

      const result = extractGraphQLOperationInfoSync(mutation)

      expect(result.operationName).toBe('SaveV2')
      expect(result.operationType).toBe('mutation')
    })

    it('should return unknown-operation for anonymous mutations', () => {
      const mutation = `
        mutation {
          deleteProduct(id: "123")
        }
      `

      const result = extractGraphQLOperationInfoSync(mutation)

      expect(result.operationName).toBe('unknown-operation')
      expect(result.operationType).toBe('mutation')
    })
  })

  describe('subscriptions', () => {
    it('should extract operation name from a named subscription', () => {
      const subscription = `
        subscription OnOrderCreated($storeId: ID!) {
          orderCreated(storeId: $storeId) {
            id
            status
          }
        }
      `

      const result = extractGraphQLOperationInfoSync(subscription)

      expect(result.operationName).toBe('OnOrderCreated')
      expect(result.operationType).toBe('subscription')
    })
  })

  describe('error handling', () => {
    it('should return default values for invalid GraphQL', () => {
      const invalidQuery = 'this is not valid graphql'

      const result = extractGraphQLOperationInfoSync(invalidQuery)

      expect(result.operationName).toBe('unknown-operation')
      expect(result.operationType).toBe('query')
    })

    it('should return default values for empty string', () => {
      const result = extractGraphQLOperationInfoSync('')

      expect(result.operationName).toBe('unknown-operation')
      expect(result.operationType).toBe('query')
    })

    it('should handle fragment-only documents', () => {
      const fragmentOnly = `
        fragment ProductFields on Product {
          id
          name
        }
      `

      const result = extractGraphQLOperationInfoSync(fragmentOnly)

      expect(result.operationName).toBe('unknown-operation')
      expect(result.operationType).toBe('query')
    })
  })

  describe('caching', () => {
    it('should return consistent results for the same query', () => {
      const query = `
        query TestCaching {
          test
        }
      `

      const result1 = extractGraphQLOperationInfoSync(query)
      const result2 = extractGraphQLOperationInfoSync(query)

      expect(result1).toEqual(result2)
      expect(result1.operationName).toBe('TestCaching')
    })
  })

  describe('real-world queries from MessagesGraphQL', () => {
    it('should extract Translate from messages query', () => {
      const query = `
        query Translate($args: TranslateArgs!) {
          translate(args: $args)
        }
      `

      const result = extractGraphQLOperationInfoSync(query)

      expect(result.operationName).toBe('Translate')
      expect(result.operationType).toBe('query')
    })

    it('should extract TranslateWithDeps from messages query', () => {
      const query = `
        query TranslateWithDeps($args: TranslateWithDependenciesArgs!) {
          translateWithDependencies(args: $args)
        }
      `

      const result = extractGraphQLOperationInfoSync(query)

      expect(result.operationName).toBe('TranslateWithDeps')
      expect(result.operationType).toBe('query')
    })

    it('should extract UserTranslations from messages query', () => {
      const query = `
        query UserTranslations($args: IndexedMessages!){
          userTranslations(args: $args) {
            srcLang
            groupContext
            context
            translations {
              lang
              translation
            }
          }
        }
      `

      const result = extractGraphQLOperationInfoSync(query)

      expect(result.operationName).toBe('UserTranslations')
      expect(result.operationType).toBe('query')
    })
  })
})

