/* @flow */
import axios from 'axios'

const data = ({data}) => data

export type ClientOptions = {
  authToken: string,
  userAgent: string,
  accept: string,
}

export default class Client {
  http: any
  constructor (baseURL: string, {authToken, userAgent, accept}: ClientOptions) {
    if (!authToken || !userAgent || !accept) {
      throw new Error('All options are required: {authToken, userAgent, accept}.')
    }
    const headers = {
      'Authorization': `token ${authToken}`,
      'User-Agent': userAgent,
      'Accept': accept,
    }
    this.http = axios.create({
      baseURL,
      headers,
    })
    this.http.interceptors.response.use(data, (err) => {
      delete err.response.request
      delete err.response.config
      delete err.config
      return Promise.reject(err)
    })
  }
}
