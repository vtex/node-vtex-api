import {reduce} from 'ramda'

export const hrToMillis = ([seconds, nanoseconds]: [number, number]) =>
  Math.round((seconds * 1e3) + (nanoseconds / 1e6))

export const hrToNano = ([seconds, nanoseconds]: [number, number]) =>
  seconds * 1e9 + nanoseconds

export const formatNano = (nanoseconds: number): string =>
  `${(nanoseconds / 1e9).toFixed(0)}s ${((nanoseconds / 1e6) % 1e3).toFixed(0)}ms`

export const reduceHrToNano =
  reduce((acc: number, hr: [number, number]) => acc + hrToNano(hr), 0)
