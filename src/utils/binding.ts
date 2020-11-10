export interface Binding {
  id?: string
  rootPath?: string
  locale: string
  currency?: string
}

enum BindingHeaderFormat {
  webframework0='v0+webframework',
  kuberouter0='v0+kuberouter',
}

export const formatBindingHeaderValue = (
  binding: Binding,
  format: BindingHeaderFormat = BindingHeaderFormat.webframework0
): string => {
  if (format === BindingHeaderFormat.webframework0) {
    const jsonString = JSON.stringify(binding)
    return Buffer.from(jsonString, 'utf8').toString('base64')
  }

  if (format === BindingHeaderFormat.kuberouter0) {
    return [
      '0',
      binding.id || '',
      binding.rootPath || '',
      binding.locale || '',
      binding.currency || '',
    ].join(',')
  }

  throw new Error(`Unkown binding format: ${format}`)
}

export const parseBindingHeaderValue = (value: string): Binding => {
  if (value[0] === '0' && value[1] === ',') {
    // v0+kuberouter
    const [, id, rootPath, locale, currency] = value.split(',')
    return {
      currency: currency || undefined,
      id: id || undefined,
      locale,
      rootPath: rootPath || undefined,
    }
  }

  // v0+webframework
  const jsonString = Buffer.from(value, 'base64').toString('utf8')
  return JSON.parse(jsonString)
}
