import { cleanJson } from './json'

const SENSITIVE_FIELDS = ['authorization', 'cookie', 'Cookie', 'vtexidclientautcookie', 'vtexIdclientautcookie', 'rawHeaders', 'error']

export const cleanLog = (log: any) => {
    return cleanJson(log, SENSITIVE_FIELDS)
}
