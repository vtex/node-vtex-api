function jsonToBase64(json: object) {
  return Buffer.from(JSON.stringify(json)).toString('base64')
}

export function getMockConflicts(path: string, base: object, mine: object, master: object) {
  return {
    data: [
      {
        base: {
          content: jsonToBase64(base),
          mimeType: 'application/json',
        },
        master: {
          content: jsonToBase64(master),
          mimeType: 'application/json',
        },
        mine: {
          content: jsonToBase64(mine),
          mimeType: 'application/json',
        },
        path,
      },
    ],
  }
}
