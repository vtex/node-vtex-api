export const PROVIDER_SPACER = '::'

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IOMessage {
  id: string
  content?: string
  description?: string
  from?: string
  to?: string
  behavior?: string
}

export const providerFromMessage = (message: IOMessage) => {
  const {provider} = parseIOMessageId(message)
  return provider || 'unknown'
}

export const parseIOMessageId = ({id}: IOMessage) => {
  const splitted = id.split(PROVIDER_SPACER)
  if (splitted.length === 2) {
    return {
      locator: splitted[1],
      provider: splitted[0],
    }
  }
  return {
    locator: splitted[0],
  }
}

export const removeProviderFromId = (message: IOMessage) => ({
  ...message,
  id: parseIOMessageId(message).locator,
})
