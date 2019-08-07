import { compose, fromPairs, map, toPairs } from 'ramda'

export const renameBy = <K>(
  fn: (key: string) => string,
  obj: Record<string, K>
): Record<string, K> =>
  compose<
    Record<string, K>,
    Array<[string, K]>,
    Array<[string, K]>,
    Record<string, K>
  >(
    fromPairs,
    map(([key, val]) => [fn(key), val] as [string, K]),
    toPairs
  )(obj)
