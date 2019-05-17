export const PROVIDER_SPACER = '::'

export interface IOMessage {
  id: string
  content?: string
  description?: string
  from?: string
  to?: string
}

export const providerFromMessage = ({id}: IOMessage) => {
  const splitted = id.split(PROVIDER_SPACER)
  if (splitted.length === 2) {
    return splitted[0]
  }
  return 'unknown'
}
