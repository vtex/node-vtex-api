export const addPrefixOntoObjectKeys = (prefix: string, obj: Record<string, string>) => {
  const ret: Record<string, string> = {}
  const entries = Object.entries(obj)
  for (const [key, val] of entries) {
    ret[`${prefix}.${key}`] = val
  }
  return ret
}
