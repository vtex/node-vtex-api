import { cleanJson } from './json'

const SENSITIVE_FIELDS = [
    'auth',
    'authorization',
    'authtoken',
    'cookie',
    'proxy-athorization',
    'rawheaders',
    'token',
    'vtexIdclientautcookie',
    'x-vtex-api-appkey',
    'x-vtex-api-apptoken',
    'x-vtex-credential',
    'x-vtex-session',
]

export const cleanLog = (log: {[k: string]: any}) => {
    return cleanJson(log, SENSITIVE_FIELDS)
}
