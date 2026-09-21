import { createHash } from 'crypto'

const deterministicReplacer = (_: any, v: any) => {
  return typeof v !== 'object' || v === null || Array.isArray(v) ? v :
    Object.fromEntries(Object.entries(v).sort(([ka], [kb]) =>
      ka < kb ? -1 : ka > kb ? 1 : 0))
}

export function computeBodyHash(data: any, onSerializeError?: () => void): string {
  if (Buffer.isBuffer(data)) {
    return createHash('md5').update(data).digest('hex')
  }

  const replacer = (key: string, value: any) => {
    try {
      return deterministicReplacer(key, value)
    }
    catch (error) {
      // I don't believe this will ever happen, but just in case
      // Also, I didn't include error as I am unsure if it would have sensitive information
      onSerializeError?.()
      return value
    }
  }

  return createHash('md5').update(JSON.stringify(data, replacer)).digest('hex')
}
