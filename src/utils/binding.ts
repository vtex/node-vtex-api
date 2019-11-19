export interface Binding {
  id?: string
  locale: string
}

export const formatBindingHeaderValue = (binding: Binding): string => {
  const jsonString = JSON.stringify(binding)
  return Buffer.from(jsonString, 'utf8').toString('base64')
}

export const parseBindingHeaderValue = (value: string): Binding => {
  const jsonString = Buffer.from(value, 'base64').toString('utf8')
  return JSON.parse(jsonString)
}
