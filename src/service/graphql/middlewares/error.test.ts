import { graphqlError } from './error'

const token = 'Bearer abcdefghijklmnop'

const graphqlErrorWithSensitive = (path: any[]) => ({
  extensions: {
    exception: {
      request: {path: '/api/price/x'},
      sensitive: {config: {headers: {authorization: token}}},
    },
  },
  message: 'failed',
  path,
})

const ctxWith = (body: any, errors: any[]) => ({
  body,
  graphql: {graphqlResponse: {errors}},
  headers: {},
  method: 'POST',
  query: {},
  remove: () => undefined,
  set: () => undefined,
  status: 200,
  vtex: {
    logger: {log: () => undefined},
    production: false,
    route: {id: 'graphql', params: {}},
  },
})

describe('graphqlError', () => {
  it('drops exception.sensitive from each result of a batched query', async () => {
    const first = graphqlErrorWithSensitive(['products', 0, 'price'])
    const ctx = ctxWith(
      [{data: null, errors: [first]}],
      [first]
    )

    await graphqlError(ctx as any, () => Promise.resolve())

    expect((ctx.body as any)[0].errors[0].extensions.exception.sensitive).toBeUndefined()
    expect(JSON.stringify(ctx.body)).not.toContain(token)
  })

  it('keeps every GraphQL error when two failures share an upstream path', async () => {
    const first = graphqlErrorWithSensitive(['products', 0, 'price'])
    const second = graphqlErrorWithSensitive(['products', 1, 'price'])
    const ctx = ctxWith({errors: [first, second]}, [first, second])

    await graphqlError(ctx as any, () => Promise.resolve())

    const errors = (ctx.body as any).errors
    expect(errors).toHaveLength(2)
    expect(errors[0].path).toEqual(['products', 0, 'price'])
    expect(errors[1].path).toEqual(['products', 1, 'price'])
  })
})
