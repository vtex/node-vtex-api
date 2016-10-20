/* @flow */
import axios from 'axios'

const data = ({data}) => data

export type ClientOptions = {
  authToken: string,
  userAgent: string,
  accept?: string,
}

export default class Client {
  http: any
  constructor (baseURL: string, {authToken, userAgent, accept}: ClientOptions = {}) {
    if (!baseURL || !authToken || !userAgent) {
      throw new Error('A required argument is missing: (baseURL, {authToken, userAgent}).')
    }
    const headers: Object = {
      'Authorization': `token ${authToken}`,
      'User-Agent': userAgent,
    }
    if (accept) {
      headers['Accept'] = accept
    }
    this.http = axios.create({
      baseURL,
      headers,
    })
    this.http.interceptors.response.use(data, (err) => {
      try {
        delete err.response.request
        delete err.response.config
        delete err.config
      } catch (e) {}
      return Promise.reject(err)
    })
  }
}
