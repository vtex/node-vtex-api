import { error } from './error'

const ctxFor = () => ({
  body: undefined as any,
  headers: {},
  method: 'GET',
  query: {},
  remove: () => undefined,
  set: () => undefined,
  status: 200,
  vtex: {
    logger: {log: () => undefined},
    route: {id: 'route', params: {}},
  },
})

describe('error middleware', () => {
  it('omits stack and config when a plain object is thrown', async () => {
    const ctx = ctxFor()

    await error(ctx as any, () => Promise.reject({
      config: {headers: {}, url: '/u'},
      message: 'bad',
      stack: 'secret-stack',
      status: 502,
    }))

    expect(Object.keys(ctx.body).sort()).toEqual(['message', 'status'])
    expect(ctx.body.message).toBe('bad')
    expect(ctx.body.status).toBe(502)
    expect(ctx.status).toBe(502)
  })
})
