import { cleanJson } from './json'

const SENSITIVE_FIELDS = ['cookie', 'Cookie', 'vtexIdclientautcookie', 'error']

export const cleanLog = (log: {[k: string]: any}) => {
    return cleanJson(log, SENSITIVE_FIELDS)
}
