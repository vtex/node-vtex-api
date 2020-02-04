import { Maybe } from './../service/worker/runtime/typings'

export const renameBy = <T extends Record<string, V>, V>(
  fn: (key: string) => string,
  object: Maybe<T>
) => object && Object.keys(object).reduce(
  (acc, key) => {
    acc[fn(key)] = object[key]
    return acc
  },
  {} as Record<string, V>
)
