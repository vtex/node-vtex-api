const endpoints = {
  STABLE: 'http://apps.vtex.com',
  BETA: 'http://apps.beta.vtex.com',
}

export default function getUrl (env) {
  if (!endpoints[env]) {
    return endpoints.STABLE
  }

  return endpoints[env]
}
