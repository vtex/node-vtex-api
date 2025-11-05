import { OptionsCreateBinding } from './types'

const assertBindingInput = ({ addrs, canonicalAddr, supportedLocales, defaultLocale }: OptionsCreateBinding) => {
  if (addrs.length === 0) {
    throw new Error('A binding must have at least one address')
  }

  const canonicalAddrExists = addrs.some((addr) => canonicalAddr.host === addr.host && canonicalAddr.path === addr.path)

  if (!canonicalAddrExists) {
    throw new Error('The canonical address must exist within the address list')
  }

  if (supportedLocales.length === 0) {
    throw new Error('A binding must have at least one locale')
  }

  const defaultLocaleExists = supportedLocales.some((locale) => defaultLocale === locale)

  if (!defaultLocaleExists) {
    throw new Error('The default locale must exist within the supported locales')
  }
}

export default assertBindingInput
