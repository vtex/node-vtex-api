import { cleanJson } from './json'

const SENSITIVE_FIELDS = ['authorization', 'cookie', 'vtexidclientautcookie', 'rawheaders', 'error']

export const cleanLog = (log: any) => {
    return cleanJson(log, SENSITIVE_FIELDS)
}
