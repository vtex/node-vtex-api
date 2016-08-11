import request from 'requisition'
import Request from 'requisition/lib/request'

export default request

export function successful (status) {
  return status >= 200 && status < 300
}

export function StatusCodeError (statusCode, statusMessage, response) {
  this.name = 'StatusCodeError'
  this.status = this.statusCode = statusCode
  this.message = statusMessage
  this.res = this.response = response

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this)
  }
}
StatusCodeError.prototype = Object.create(Error.prototype)
StatusCodeError.prototype.constructor = StatusCodeError

Request.prototype._then = Request.prototype.then

Request.prototype.then = function (resolve, reject) {
  return this._then(res => {
    if (successful(res.statusCode)) {
      return resolve(res)
    }
    const error = new StatusCodeError(res.statusCode, res.statusMessage, res)
    if (res.is('json')) {
      return res.json().then(body => {
        error.error = body
        throw error
      })
    }
    throw error
  }, reject)
}

Request.prototype.json = function () {
  return this.then(res => {
    if (res.is('json')) {
      return res.json()
    }
    return res
  })
}
