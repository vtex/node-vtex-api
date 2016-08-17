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

const prototypeThen = Request.prototype.then

Request.prototype.then = function (resolve, reject) {
  return prototypeThen.call(this, res => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return resolve(res)
    }
    const error = new StatusCodeError(res.statusCode, res.statusMessage, res)
    if (res.is('json')) {
      return res.json().then(body => {
        error.error = body
        throw error
      })
    } else if (res.is('text')) {
      return res.text().then(body => {
        error.error = body
        throw error
      })
    }
    throw error
  }, reject)
}

Request.prototype.thenJson = function () {
  return this.then(res => {
    if (res.is('json')) {
      return res.json()
    }
    return res
  })
}

Request.prototype.thenText = function () {
  return this.then(res => res.text())
}
