import { APIBindingRes } from './types'

const getPath = (basePath: string, localizationPath: string): string => {
  if (basePath === '') {
    return `/${localizationPath}`
  }

  if (localizationPath === '') {
    return `/${basePath}`
  }

  return `/${basePath}/${localizationPath}`
}

export const getCanonicalAndAlternateAddresses = (
  binding: APIBindingRes
): { canonicalBaseAddress: string; alternateBaseAddresses: string[] } => {
  let canonicalBaseAddress = ''
  const alternateBaseAddresses: string[] = []

  for (const address of binding.Addresses) {
    const localizationPaths = Object.keys(address.Localization)

    for (const localizationPath of localizationPaths) {
      alternateBaseAddresses.push(address.Host + getPath(address.BasePath, localizationPath))
    }

    if (address.IsCanonical) {
      // The canonical address is built from the shortest localization key.
      const [shortestPath = ''] = [...localizationPaths].sort((a, b) => a.length - b.length)
      canonicalBaseAddress = address.Host + getPath(address.BasePath, shortestPath)
    }
  }

  // The canonical address must not also be listed as an alternate.
  const canonicalIndex = alternateBaseAddresses.indexOf(canonicalBaseAddress)
  if (canonicalIndex !== -1) {
    alternateBaseAddresses.splice(canonicalIndex, 1)
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
