import { cleanJson } from './json'

const SENSITIVE_FIELDS = [
    'auth',
    'authorization',
    'authtoken',
    'cookie',
    'Cookie',
    'proxy-authorization',
    'rawheaders',
    'token',
    'x-vtex-api-appkey',
    'x-vtex-api-apptoken',
    'x-vtex-credential',
    'x-vtex-session',
    'vtexidclientautcookie',
]

export const removeSensitiveData = (log: any) => {
    return cleanJson(log, SENSITIVE_FIELDS)
}
