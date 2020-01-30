export interface BindingHeader {
  id?: string
  locale: string
}

export const formatBindingHeaderValue = (binding: BindingHeader): string => {
  const jsonString = JSON.stringify(binding)
  return Buffer.from(jsonString, 'utf8').toString('base64')
}

export const parseBindingHeaderValue = (value: string): BindingHeader => {
  const jsonString = Buffer.from(value, 'base64').toString('utf8')
  return JSON.parse(jsonString)
}
