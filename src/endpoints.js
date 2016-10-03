export function api (env) {
  return {
    STABLE: 'http://api.vtex.com',
    BETA: 'http://api.beta.vtex.com',
  }[env] || env
}

export function vbase (env) {
  return {
    STABLE: 'http://vbase.vtex.com',
    BETA: 'http://vbase.beta.vtex.com',
  }[env] || env
}

export function vtexid (env) {
  return {
    STABLE: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
    BETA: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
  }[env] || env
}
