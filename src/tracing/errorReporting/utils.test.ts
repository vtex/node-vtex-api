import { sanitizeJwtToken, truncateAndSanitizeStringsFromObject } from './utils'

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
  [5, { namedFn: function fn() {} }],
  [5, { arrowFunctionNamed: () => {} }],
  [5, [() => {}]],
  [5, { a: Symbol('symbol description'), b: Symbol('symbol description 2') }],
  [5, { token: 'a.b.c', b: 'any' }],
  [20, { AuThOrIzAtIoN: 'Bearer aa.bb.cc', authToken: 'a.b.c', auth: 'b.c.d', AuthToken: '!jwt' }],
  [20, { auth: { authToken: 'm.n.o' } }],
  [5, '123456'],
  [5, { buf: Buffer.from('this is a test'), b: 'a string' }],
])('Works on testcase %# - String limit %d', (limit: number, obj: any) => {
  expect(truncateAndSanitizeStringsFromObject(obj, limit)).toMatchSnapshot()
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
  ] as [() => any, any][])(`Doesn't throw on circular %#`, (objCreator, expected) => {
    expect(truncateAndSanitizeStringsFromObject(objCreator(), 5)).toStrictEqual(expected)
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
  ] as [() => any, any][])(
    `Doesn't add '[circular]' when references another node but it's not circular %#`,
    (objCreator, expected) => {
      expect(truncateAndSanitizeStringsFromObject(objCreator(), 5)).toStrictEqual(expected)
    }
  )
})

describe('sanitizeJwtToken', () => {
  it.each([
    ['a.b.c', 'a.b'],
    ['aa.bb.cc', 'aa.bb'],
    ['Bearer aa.bb.cc', 'Bearer aa.bb'],
  ])('Sanitizes strings with three parts separated by dots (just like jwt): %s', (str: string, expected: string) => {
    expect(sanitizeJwtToken(str)).toEqual(expected)
  })

  it.each([['a.b'], ['aaa']])("Returns the string itself in case it couldn't be jwt: %s", (str: string) => {
    expect(sanitizeJwtToken(str)).toEqual(str)
  })
})
