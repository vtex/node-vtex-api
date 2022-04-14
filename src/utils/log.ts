import { cleanJson } from './json'

const SENSITIVE_FIELDS = [
    'cookie',
    'Cookie',
    'vtexIdclientautcookie',
]

export const cleanLog = (log: {[k: string]: any}) => {
    return cleanJson(log, SENSITIVE_FIELDS)
}
