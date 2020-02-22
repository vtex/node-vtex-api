import { uniq } from 'ramda'

const VTEX_PUBLIC_ENDPOINT = process.env.VTEX_PUBLIC_ENDPOINT ?? 'myvtex.com'

export const PUBLIC_DOMAINS = uniq([VTEX_PUBLIC_ENDPOINT, 'myvtex.com', 'mygocommerce.com', 'vtexsmb.com'])
