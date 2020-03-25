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
])('Works on testcase %# - String limit %d', (limit: number, obj: any) => {
  expect(truncateStringsFromObject(obj, limit)).toMatchSnapshot()
})
