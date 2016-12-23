export function api (env) {
  return {
    STABLE: 'http://api.vtex.com',
    BETA: 'http://api.beta.vtex.com',
  }[env] || env
}

export function apps (env) {
  return {
    STABLE: 'http://apps-engine.aws-us-east-1.vtex.io',
    BETA: 'http://apps-engine.aws-us-east-1.vtex.io',
    NEXT: 'http://apps-engine.aws-us-east-1.vtex.io',
  }[env] || env
}

export function registry (env) {
  return {
    STABLE: 'http://apps-registry.aws-us-east-1.vtex.io',
    BETA: 'http://apps-registry.aws-us-east-1.vtex.io',
    NEXT: 'http://apps-registry.aws-us-east-1.vtex.io',
  }[env] || env
}

export function vbase (env) {
  return {
    STABLE: 'http://vbase.vtex.com',
    BETA: 'http://vbase.beta.vtex.com',
    NEXT: 'http://vbase.aws-us-east-1.vtex.io',
  }[env] || env
}

export function router (env) {
  return {
    STABLE: 'http://kube-router.aws-us-east-1.vtex.io',
    BETA: 'http://kube-router.aws-us-east-1.vtex.io',
    NEXT: 'http://kube-router.aws-us-east-1.vtex.io',
  }[env] || env
}

export function workspaces (env) {
  return {
    STABLE: 'http://kube-router.aws-us-east-1.vtex.io',
    BETA: 'http://kube-router.aws-us-east-1.vtex.io',
    NEXT: 'http://kube-router.aws-us-east-1.vtex.io',
  }[env] || env
}

export function vtexid (env) {
  return {
    STABLE: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
    BETA: 'https://vtexid.vtex.com.br/api/vtexid/pub/authentication',
  }[env] || env
}
