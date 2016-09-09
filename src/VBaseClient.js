import request from './http'
import Request from 'requisition/lib/request'
import getEndpointUrl from './utils/vbaseEndpoints.js'
import checkRequiredParameters from './utils/required.js'
import {createGzip} from 'zlib'
import {basename} from 'path'

class VBaseClient {
  constructor ({authToken, userAgent, endpointUrl = getEndpointUrl('STABLE')}) {
    checkRequiredParameters({authToken, userAgent})
    this.authToken = authToken
    this.endpointUrl = endpointUrl === 'BETA'
      ? getEndpointUrl(endpointUrl)
      : endpointUrl
    this.userAgent = userAgent
    this.headers = {
      authorization: `token ${this.authToken}`,
      'user-agent': this.userAgent,
    }
    this.http = request.defaults({
      headers: this.headers,
    })
  }

  promote (account, workspace) {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.WorkspaceMaster(account, workspace)}`

    return this.http.put(url).send({workspace}).thenJson()
  }

  list (account) {
    checkRequiredParameters({account})
    const url = `${this.endpointUrl}${this.routes.Account(account)}`

    return this.http.get(url).thenJson()
  }

  create (account, workspace) {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.Account(account)}`

    return this.http.post(url).send({name: workspace}).thenJson()
  }

  get (account, workspace) {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.Workspace(account, workspace)}`

    return this.http.get(url).thenJson()
  }

  delete (account, workspace) {
    checkRequiredParameters({account, workspace})
    const url = `${this.endpointUrl}${this.routes.Workspace(account, workspace)}`

    return this.http.delete(url).thenJson()
  }

  listFiles (account, workspace, bucket, prefix = '') {
    checkRequiredParameters({account, workspace, bucket})
    const url = `${this.endpointUrl}${this.routes.Files(account, workspace, bucket)}`

    return this.http.get(url).query({prefix}).thenJson()
  }

  getFile (account, workspace, bucket, path) {
    checkRequiredParameters({account, workspace, bucket, path})
    const url = `${this.endpointUrl}${this.routes.Files(account, workspace, bucket, path)}`

    return this.http.get(url).thenText()
  }

  saveFile (account, workspace, bucket, path, streamOrPath, {unzip, gzip} = {}) {
    checkRequiredParameters({account, workspace, bucket, path, streamOrPath})
    const url = `${this.endpointUrl}${this.routes.Files(account, workspace, bucket, path)}`
    let put = this.http.put(url)
    if (streamOrPath.pipe && streamOrPath.on) {
      put = put.type(basename(path))
      if (gzip) {
        const gz = createGzip()
        return Request.prototype.thenJson.apply(
          put.set('Content-Encoding', 'gzip').sendStream(streamOrPath.pipe(gz))
        )
      }
      return Request.prototype.thenJson.apply(put.sendStream(streamOrPath))
    }
    if (typeof streamOrPath === 'string' || streamOrPath instanceof String) {
      return put.query({unzip}).sendFile(streamOrPath).thenJson()
    }
    throw new Error('Argument streamOrPath must be a readable stream or the path to a file.')
  }

  deleteFile (account, workspace, bucket, path) {
    checkRequiredParameters({account, workspace, bucket, path})
    const url = `${this.endpointUrl}${this.routes.Files(account, workspace, bucket, path)}`

    return this.http.delete(url).thenJson()
  }
}

VBaseClient.prototype.routes = {
  Account (account) {
    return `/${account}`
  },

  Workspace (account, workspace) {
    return `${this.Account(account)}/${workspace}`
  },

  WorkspaceMaster (account) {
    return `${this.Account(account)}/master`
  },

  Files (account, workspace, bucket, path) {
    return `${this.Workspace(account, workspace)}/buckets/${bucket}/files${path ? '/' + path : ''}`
  },
}

export default VBaseClient
