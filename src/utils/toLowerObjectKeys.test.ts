import { toLowerObjectKeys } from './toLowerObjectKeys'

/* tslint:disable:object-literal-sort-keys */

test('Result object has keys lowercased', () => {
  expect(toLowerObjectKeys({ ABC: 123, bCd: 234, 'BC-5': '123' })).toStrictEqual({
    abc: 123,
    bcd: 234,
    'bc-5': '123',
  })
})

test(`Object passed as argument isn't changed`, () => {
  const obj = { ABC: 123, bCd: 234 }
  toLowerObjectKeys(obj)
  expect(obj).toStrictEqual({ ABC: 123, bCd: 234 })
})
