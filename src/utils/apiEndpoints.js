const endpoints = {
  STABLE: 'http://api.vtex.com',
  BETA: 'http://api.beta.vtex.com',
}

export default function getUrl (env) {
  if (!endpoints[env]) {
    return endpoints.STABLE
  }

  return endpoints[env]
}
