import { cleanJson } from './json'

const SENSITIVE_FIELDS = [
    'auth',
    'authorization',
    'authtoken',
    'cookie',
    'proxy-authorization',
    'rawheaders',
    'token',
    'vtexidclientautcookie',
    'x-vtex-api-appkey',
    'x-vtex-api-apptoken',
    'x-vtex-credential',
    'x-vtex-session',
]

export const cleanLog = (log: any) => {
    return cleanJson(log, SENSITIVE_FIELDS)
}
