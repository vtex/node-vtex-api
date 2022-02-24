export const FIRST_LEVEL_SENSITIVE_FIELDS = ['config', 'request', 'stack', 'error']
export const SECOND_LEVEL_SENSITIVE_FIELDS = [ ['parsedInfo', 'requestConfig'], ['headers', 'cookie'] ]

export const removeSensitiveData = (log: any) => {
    FIRST_LEVEL_SENSITIVE_FIELDS.forEach(field => {
        delete log[field]
    })

    SECOND_LEVEL_SENSITIVE_FIELDS.forEach(field => {
        if (field[0] in log) {
            delete log[field[0]][field[1]]
        }
    })
}
