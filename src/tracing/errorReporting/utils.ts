export function truncateStringsFromObject(element: any, maxStrSize: number) {
  if (element == null) {
    return element
  }
  if (typeof element === 'object') {
    Object.keys(element).forEach(key => {
      element[key] = truncateStringsFromObject(element[key], maxStrSize)
    })
    return element
  }
  if (typeof element === 'string' && element.length > maxStrSize) {
    return `${element.substr(0, maxStrSize)}[...TRUNCATED]`
  }
  return element
}
