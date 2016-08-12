const endpoints = {
  STABLE: 'http://vbase.vtex.com',
  BETA: 'http://vbase.beta.vtex.com',
}

export default function getEndpointUrl (env) {
  if (!endpoints[env]) {
    return endpoints.STABLE
  }

  return endpoints[env]
}
