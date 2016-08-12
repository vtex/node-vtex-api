const endpoints = {
  STABLE: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
}

export default function getEndpointUrl (env) {
  if (!endpoints[env]) {
    return endpoints.STABLE
  }

  return endpoints[env]
}
