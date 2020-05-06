const tokenFields = ['authorization', 'authtoken', 'auth', 'token']

export function sanitizeJwtToken(token: string): string {
  const tokenParts = token.split('.')

  // Not JWT token
  if (tokenParts.length !== 3) {
    return token
  }

  return `${tokenParts[0]}.${tokenParts[1]}`
}

export function truncateAndSanitizeStringsFromObject(
  element: any,
  maxStrSize: number,
  depth = 3,
  seenObjects: any[] = [],
  currentKey?: string
) {
  if (element == null) {
    return element
  }

  const objType = typeof element

  if (objType === 'object') {
    if (seenObjects.includes(element)) {
      return '[circular]'
    }

    if (Buffer.isBuffer(element)) {
      return { type: 'buffer', byteLength: Buffer.byteLength(element) }
    }

    if (depth === 0) {
      return Array.isArray(element) ? `[array]` : `[object]`
    }

    seenObjects.push(element)
    Object.keys(element).forEach(key => {
      // seenObjects.slice creates a copy of seenObjects at the current state
      element[key] = truncateAndSanitizeStringsFromObject(element[key], maxStrSize, depth - 1, seenObjects.slice(), key)
    })

    return element
  }

  if (objType === 'string') {
    const currentKeyNormalized = currentKey?.toLowerCase()
    if (currentKeyNormalized && tokenFields.includes(currentKeyNormalized)) {
      element = sanitizeJwtToken(element)
    }

    return element.length <= maxStrSize ? element : `${element.substr(0, maxStrSize)}[...TRUNCATED]`
  }

  if (objType === 'number' || objType === 'bigint' || objType === 'boolean' || objType === 'symbol') {
    return element
  }

  if (objType === 'function') {
    return `[function: ${element.name || 'anonymous'}]`
  }

  return `[${objType}]`
}
