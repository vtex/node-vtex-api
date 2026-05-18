import { filter } from 'ramda'

export const generatePathName = (rpath: [string | number]) => {
  const pathFieldNames = filter(value => typeof value === 'string', rpath)
  return pathFieldNames.join('.')
}
