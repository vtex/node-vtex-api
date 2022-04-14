import { cleanJson } from './json'

const SENSITIVE_FIELDS = ['cookie', 'Cookie', 'vtexIdclientautcookie']

export const removeSensitiveData = (log: any) => {
    return cleanJson(log, SENSITIVE_FIELDS)
}
