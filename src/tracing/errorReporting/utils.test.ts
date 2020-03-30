import { truncateStringsFromObject } from './utils'

it.each([
  [5, ['123456', '12345', '1234']],
  [5, { a: '123456', b: '12345', c: ['123456', { a: '123456' }] }],
  [10, undefined],
  [10, null],
  [10, { a: undefined, b: null }],
  [
    5,
    {
      a: [{ aa: '123456' }, { ab: '1234' }, { ac: '12345' }],
      b: { ba: undefined, bb: null, bc: '123456', bd: { bca: '123456', bcb: '1234567' } },
    },
  ],
  [5, { a: [true, false, undefined, null] }],
  // tslint:disable-next-line
  [5, { namedFn: function fn() {} }],
  // tslint:disable-next-line
  [5, { arrowFunctionNamed: () => {} }],
  // tslint:disable-next-line
  [5, [() => {}]],
  [5, { a: Symbol('symbol description'), b: Symbol('symbol description 2') }],
])('Works on testcase %# - String limit %d', (limit: number, obj: any) => {
  expect(truncateStringsFromObject(obj, limit)).toMatchSnapshot()
})

describe('Circular checkings', () => {
  it.each([
    [
      () => {
        const obj: any = { a: '123456', b: {} }
        obj.b.c = obj
        return obj
      },
      { a: '12345[...TRUNCATED]', b: { c: '[circular]' } },
    ],
    [
      () => {
        const obj: any = { a: '123456', b: { c: {}, d: 'abcdef' } }
        obj.b.c = obj.b
        return obj
      },
      { a: '12345[...TRUNCATED]', b: { c: '[circular]', d: 'abcde[...TRUNCATED]' } },
    ],
  ])(`Doesn't throw on circular %#`, (objCreator, expected) => {
    expect(truncateStringsFromObject(objCreator(), 5)).toStrictEqual(expected)
  })

  it.each([
    [
      () => {
        const obj: any = { a: 'abc', b: { d: '123456' }, c: {} }
        obj.c = obj.b
        return obj
      },
      { a: 'abc', b: { d: '12345[...TRUNCATED]' }, c: { d: '12345[...TRUNCATED]' } },
    ],
  ])(`Doesn't add '[circular]' when references another node but it's not circular %#`, (objCreator, expected) => {
    expect(truncateStringsFromObject(objCreator(), 5)).toStrictEqual(expected)
  })
})
