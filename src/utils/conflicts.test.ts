function jsonToBase64(json: Object) {
  return Buffer.from(JSON.stringify(json)).toString('base64')
}

export function getMockConflicts(path: String, base: Object, mine: Object, master: Object) {
  return {
    data: [
      {
        path,
        mine: {
          content: jsonToBase64(mine),
          mimeType: 'application/json',
        },
        master: {
          content: jsonToBase64(master),
          mimeType: 'application/json',
        },
        base: {
          content: jsonToBase64(base),
          mimeType: 'application/json',
        },
      },
    ],
  }
}
