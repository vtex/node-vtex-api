export function truncateStringsFromObject(element: any, maxStrSize: number, depth = 3, seenObjects: any[] = []) {
  if (element == null) {
    return element
  }

  const objType = typeof element

  if (objType === 'object') {
    if (seenObjects.includes(element)) {
      return '[circular]'
    }

    if (depth === 0) {
      return Array.isArray(element) ? `[array]` : `[object]`
    }

    seenObjects.push(element)
    Object.keys(element).forEach(key => {
      // seenObjects.slice creates a copy of seenObjects at the current state
      element[key] = truncateStringsFromObject(element[key], maxStrSize, depth - 1, seenObjects.slice())
    })

    return element
  } else if (objType === 'string') {
    return element.length <= maxStrSize ? element : `${element.substr(0, maxStrSize)}[...TRUNCATED]`
  } else if (objType === 'number' || objType === 'bigint' || objType === 'boolean' || objType === 'symbol') {
    return element
  } else if (objType === 'function') {
    return `[function: ${element.name || 'anonymous'}]`
  }

  return `[${objType}]`
}
