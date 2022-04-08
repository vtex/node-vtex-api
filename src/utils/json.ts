export function cleanJson(json: {[k: string]: any}, targetFields: string[]) {
    for (const key of Object.keys(json)) {
        let deleted = false
        for (const field of targetFields) {
            if (key.toLowerCase() === field) {
                delete json[key]
                deleted = true
            }
        }

        if (!deleted && json[key] && typeof json[key] === 'object') {
            json[key] = cleanJson(json[key], targetFields)
        }
    }

    return json
}
