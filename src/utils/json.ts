export function cleanJson(json: {[k: string]: any}, targetFields: string[]) {
    for (const key of json.keys()) {
        let deleted = false
        for (const field of targetFields) {
            if (key === field) {
                delete json[key]
                deleted = true
            }
        }

        if (!deleted && typeof json[key] === 'object') {
            json[key] = cleanJson(json[key], targetFields)
        }
    }

    return json
}
