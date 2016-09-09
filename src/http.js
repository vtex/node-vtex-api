import request from 'requisition'
import Request from 'requisition/lib/request'
import Response from 'requisition/lib/response'
import destroy from 'destroy'
import status from 'statuses'

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
  return this.then(res => {
    return res.response.readable ? res.text() : ''
  })
}

const baseQuery = Request.prototype.query
Request.prototype.query = function (options) {
  let query = {}
  for (let key of Object.keys(options)) {
    let value = options[key]
    if (value !== undefined && value !== '') {
      query[key] = value
    }
  }
  return baseQuery.apply(this, [query])
}

// TODO fork requisition and implement properly there.
Request.prototype.sendStream = function (stream) {
  var self = this
  return new Promise(function (resolve, reject) {
    var req = self._create()
    stream.on('error', function (err) {
      req.abort()
      reject(err)
    })
    req.on('error', function (err) {
      destroy(stream)
      reject(err)
    })
    req.on('response', function (res) {
      self.clearTimeout()
      if (status.redirect[res.statusCode]) {
        return resolve(self.redirect(res))
      }
      resolve(new Response(req, res, self.options))
    })
    req.on('close', function () {
      destroy(stream)
    })
    stream.pipe(req)
  })
}
