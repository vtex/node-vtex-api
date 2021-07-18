export function toLowerObjectKeys(obj: Record<string, any>) {
  const res: Record<string, any> = {}
  const keys = Object.keys(obj)
  for (const key of keys) {
    res[key.toLowerCase()] = obj[key]
  }

  return res
}
