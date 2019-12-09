export const toArray = <T>(x: T | T[]): T[] => Array.isArray(x) ? x : [x]
