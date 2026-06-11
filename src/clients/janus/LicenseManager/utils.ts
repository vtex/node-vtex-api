import { APIBindingRes } from './types'

const buildAddressPath = (basePath: string, localizationKey: string): string => {
  if (basePath === '') {
    return `/${localizationKey}`
  }

  if (localizationKey === '') {
    return `/${basePath}`
  }

  return `/${basePath}/${localizationKey}`
}

export const getCanonicalAndAlternateAddresses = (
  lmBinding: APIBindingRes
): { canonicalBaseAddress: string; alternateBaseAddresses: string[] } => {
  let canonicalBaseAddress = ''
  const alternateBaseAddresses: string[] = []

  for (const addressEntry of lmBinding.Addresses) {
    const localizationKeys = Object.keys(addressEntry.Localization)

    for (const localizationKey of localizationKeys) {
      alternateBaseAddresses.push(addressEntry.Host + buildAddressPath(addressEntry.BasePath, localizationKey))
    }

    if (addressEntry.IsCanonical) {
      // The canonical address is built from the shortest localization key.
      const [shortestLocalizationKey = ''] = [...localizationKeys].sort((a, b) => a.length - b.length)
      canonicalBaseAddress = addressEntry.Host + buildAddressPath(addressEntry.BasePath, shortestLocalizationKey)
    }
  }

  // The canonical address must not also appear in the alternates list.
  const canonicalIndexInAlternates = alternateBaseAddresses.indexOf(canonicalBaseAddress)
  if (canonicalIndexInAlternates !== -1) {
    alternateBaseAddresses.splice(canonicalIndexInAlternates, 1)
  }

  return { canonicalBaseAddress, alternateBaseAddresses }
}

export const inferTargetProduct = (
  canonicalBaseAddress: string,
  alternateBaseAddresses: string[]
): 'vtex-admin' | 'vtex-storefront' => {
  const isAdmin =
    canonicalBaseAddress.endsWith('myvtex.com/admin') ||
    alternateBaseAddresses.some(address => address.endsWith('myvtex.com/admin'))

  return isAdmin ? 'vtex-admin' : 'vtex-storefront'
}
