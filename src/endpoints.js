export function vtexid (env) {
  return {
    STABLE: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
    BETA: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
  }[env] || env
}
