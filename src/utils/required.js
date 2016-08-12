export default function checkRequiredParameters (params) {
  for (let key in params) {
    if (params[key] === undefined) {
      throw new Error(`${key} is a required attribute`)
    }
  }
}
